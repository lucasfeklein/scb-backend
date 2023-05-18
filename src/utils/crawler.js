import axios from "axios";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";

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

export async function crawlCheerio(url, crawledUrls = new Set()) {
  if (crawledUrls.has(url)) return [];
  crawledUrls.add(url);

  const crawledUrlsArray = [];

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });

    const contentType = response.headers["content-type"];
    if (contentType && !contentType.includes("text/html")) {
      return [];
    }

    const content = response.data.toString("utf-8");
    const $ = cheerio.load(content);

    const links = $("a").toArray();

    for (const element of links) {
      const link = $(element).attr("href");

      if (!link) continue;

      let newUrl;
      try {
        newUrl = new URL(link, url).href;
      } catch (err) {
        continue;
      }

      const fileLinkRegex = /\.(jpg|jpeg|png|gif|svg|pdf)$/i;
      if (fileLinkRegex.test(newUrl)) {
        continue;
      }

      const childUrls = await crawlCheerio(newUrl, crawledUrls);
      crawledUrlsArray.push(...childUrls);
    }
  } catch (error) {
    console.error(`Failed to crawl "${url}": ${error.message}`);
  }

  const decodedUrl = decodeURIComponent(url);
  return [decodedUrl, ...crawledUrlsArray];
}
