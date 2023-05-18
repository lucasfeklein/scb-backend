import axios from "axios";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import puppeteer from "puppeteer";
import xml2js from "xml2js";
import { env } from "../config/env.js";
import { pinecone } from "../config/pinecone.js";

export async function processWebsite(urls, hostname) {
  const docs = [];
  await pinecone.init({
    apiKey: env.PINECONE_API_KEY,
    environment: env.PINECONE_API_ENV,
  });

  const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);

  for (const url of urls) {
    if (url.isSelected) {
      const loader = new PuppeteerWebBaseLoader(url.url, {
        launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
      });
      const doc = await loader.load();
      docs.push(...doc); // use spread operator to flatten the array
    }
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
    const strippedContent = stripHtml(doc.pageContent)
      .result.replace(/\n/g, " ")
      .replace(/\s/g, " ");
    strippedDocs.push({
      ...doc,
      pageContent: strippedContent,
    });
  }
  return strippedDocs;
}

// crawler
export async function crawlWebsite(homepageUrl) {
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
    console.log("Site has no sitemap, going to crawl with puppeteer");
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const allLinks = new Set();
    const visitedPages = new Set();

    async function crawl(url) {
      if (visitedPages.has(url)) return;

      const page = await browser.newPage();
      await page.goto(url);

      const links = await page.$$eval("a", (links) => links.map((a) => a.href));

      console.log("links");
      console.log(links);

      await browser.close();

      const homepage_url = new URL(homepageUrl);
      const linksFiltered = links
        .filter((link) => link.startsWith(homepage_url.origin))
        .filter((link) => !link.includes("#"))
        // .filter((link) => !/\.(jpg|jpeg|png|gif|svg|pdf)$/i.test(link))
        .filter((link, index, array) => array.indexOf(link) === index);

      console.log("linksFiltered");
      console.log(linksFiltered);

      linksFiltered.forEach((link) => allLinks.add(link));
      visitedPages.add(url);

      for (const link of linksFiltered) {
        await crawl(link);
      }
    }

    await crawl(homepageUrl);

    await browser.close();

    return Array.from(allLinks);
  }
}
