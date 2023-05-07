import axios from "axios";
import puppeteer from "puppeteer";
import xml2js from "xml2js";

// function tu remove all the html tags from docs
export async function stripHtmlFromDocs(docs) {
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
