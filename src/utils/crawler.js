import axios from "axios";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import puppeteer from "puppeteer";
import xml2js from "xml2js";
import { env } from "../config/env.js";
import { pinecone } from "../config/pinecone.js";

import { PineconeStore } from "langchain/vectorstores/pinecone";

export async function processWebsite({ hostname }) {
  const urls = await crawlWebsite(`https://${hostname}`);

  console.log("urls");
  console.log(urls);
  const docs = [];

  await pinecone.init({
    apiKey: env.PINECONE_API_KEY,
    environment: env.PINECONE_API_ENV,
  });
  const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);

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

// function tu remove all the html tags from docs
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
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(homepageUrl);

    const links = await page.$$eval("a", (links) => links.map((a) => a.href));

    await browser.close();

    const homepage_url = new URL(homepageUrl);
    const linksFiltered = links
      .filter((link) => link.startsWith(homepage_url.origin))
      .filter((link) => !link.includes("#"))
      .filter((link, index, array) => array.indexOf(link) === index);
    console.log(linksFiltered);
    return linksFiltered;
  }
}
