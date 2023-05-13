import axios from "axios";
import cheerio from "cheerio";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import xml2js from "xml2js";
import { env } from "../config/env.js";
import { pinecone } from "../config/pinecone.js";

export async function processWebsite({ hostname }) {
  const urls = await crawlWebsite(`https://${hostname}`);

  const docs = [];
  await pinecone.init({
    apiKey: env.PINECONE_API_KEY,
    environment: env.PINECONE_API_ENV,
  });
  console.log("5");
  const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);
  console.log("6");
  for (const url of urls) {
    const loader = new PuppeteerWebBaseLoader(url);
    const doc = await loader.load();
    docs.push(...doc); // use spread operator to flatten the array
  }
  const docsTextOnly = await stripHtmlFromDocs(docs);

  console.log("docsTextOnly");
  console.log(docsTextOnly);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 0,
  });
  const docOutput = await splitter.splitDocuments(docsTextOnly);
  console.log("docOutput");
  console.log(docOutput);
  await PineconeStore.fromDocuments(docOutput, new OpenAIEmbeddings(), {
    pineconeIndex,
    namespace: hostname,
  });
}

// function to remove all the html tags from docs
async function stripHtmlFromDocs(docs) {
  const { stripHtml } = await import("string-strip-html");
  const strippedDocs = [];
  for (const doc of docs) {
    const strippedContent = stripHtml(doc.pageContent).result;
    strippedDocs.push({
      ...doc,
      pageContent: strippedContent,
    });
  }
  return strippedDocs;
}

// crawler
async function crawlWebsite(homepageUrl) {
  try {
    const response = await axios.get(`${homepageUrl}/sitemap.xml`);
    const xmlData = response.data;
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);
    const urls = result.urlset.url.map((item) =>
      item.loc[0].replace(/\n/g, "").trim()
    );
    console.log(urls);
    return urls;
  } catch (error) {
    const visitedUrls = new Set(); // Use a Set to keep track of visited urls
    const urlsToVisit = [homepageUrl]; // Initialize urls to visit with the homepage url
    const hrefs = new Set(); // Use a Set to remove duplicates
    while (urlsToVisit.length > 0) {
      const currentUrl = urlsToVisit.shift(); // Get the next url to visit from the front of the urlsToVisit array
      if (visitedUrls.has(currentUrl)) {
        continue; // Skip urls that have already been visited
      }
      visitedUrls.add(currentUrl); // Mark the current url as visited
      try {
        const res = await axios.get(currentUrl);
        const $ = cheerio.load(res.data);
        const links = $("a"); // Select all anchor tags
        links.each((i, link) => {
          const href = $(link).attr("href");
          if (href && href.startsWith("/")) {
            const absoluteUrl = new URL(href, currentUrl).href; // Convert the relative url to an absolute url
            if (!visitedUrls.has(absoluteUrl)) {
              // Add the absolute url to urlsToVisit if it hasn't been visited yet
              urlsToVisit.push(absoluteUrl);
            }
            hrefs.add(decodeURIComponent(absoluteUrl)); // Add the absolute url to the hrefs Set
          }
        });
      } catch (error) {
        console.log(`Error while crawling ${currentUrl}: ${error.message}`);
      }
    }
    const uniqueHrefs = [...hrefs]; // Convert Set back to array
    console.log(uniqueHrefs);
    return uniqueHrefs;
  }
}
