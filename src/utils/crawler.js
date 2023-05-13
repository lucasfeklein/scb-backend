import axios from "axios";
import cheerio from "cheerio";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import xml2js from "xml2js";
import { env } from "../config/env.js";
import { pinecone } from "../config/pinecone.js";

export async function processWebsite({ hostname }) {
  let urls = await crawlSitemap(`https://${hostname}`);

  if (!urls) {
    urls = await crawlCheerio(`https://${hostname}`);
  }

  const docs = [];
  await pinecone.init({
    apiKey: env.PINECONE_API_KEY,
    environment: env.PINECONE_API_ENV,
  });

  const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);

  for (const url of urls) {
    const loader = new PuppeteerWebBaseLoader(url, {
      launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    });
    const doc = await loader.load();
    docs.push(...doc); // use spread operator to flatten the array
  }
  console.log(urls);
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
export async function crawlSitemap(homepageUrl) {
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
    console.log("Site has no sitemap, going to crawl with cheerio");
    return "";
  }
}

export async function crawlCheerio(url, crawledUrls = new Set()) {
  // Avoid re-crawling the same URL
  if (crawledUrls.has(url)) return [];
  crawledUrls.add(url);

  const crawledUrlsArray = [];

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Find and crawl all links
    const links = $("a").toArray(); // Convert to array

    for (const element of links) {
      const link = $(element).attr("href");

      // Check if link is relative
      if (link && link.startsWith("/") && link.length > 1) {
        const newUrl = new URL(link, url).href; // Convert to absolute URL
        const childUrls = await crawlCheerio(newUrl, crawledUrls); // Await the recursive call
        crawledUrlsArray.push(...childUrls);
      }
      // Check if link is absolute and from the same domain
      else if (link && link.startsWith(url)) {
        const childUrls = await crawlCheerio(link, crawledUrls); // Await the recursive call
        crawledUrlsArray.push(...childUrls);
      }
    }
  } catch (error) {
    console.error(`Failed to crawl "${url}": ${error.message}`);
  }
  const decodedUrl = decodeURIComponent(url);
  return [decodedUrl, ...crawledUrlsArray];
}
