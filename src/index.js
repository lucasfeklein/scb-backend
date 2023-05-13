import { createServer } from "http";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { Configuration, OpenAIApi } from "openai";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { env } from "./config/env.js";
import { pinecone } from "./config/pinecone.js";
import { prisma } from "./config/prisma.js";
import routes from "./routes/index.js";

const configuration = new Configuration({
  apiKey: env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const embeddings = new OpenAIEmbeddings();

const server = createServer(app);
const wss = new WebSocketServer({ server });

async function verifyHostname(hostname) {
  if (!(hostname && hostname.length > 0)) return false;

  const company = await prisma.company.findUnique({
    where: {
      website: hostname,
    },
  });

  return company !== null;
}

wss.on("connection", async (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const hostname = url.searchParams.get("hostname");

  const isHostnameValid = await verifyHostname(hostname);

  if (!isHostnameValid) {
    ws.send("Invalid hostname");
    ws.close();
    return;
  }

  await pinecone.init({
    apiKey: env.PINECONE_API_KEY,
    environment: env.PINECONE_API_ENV,
  });
  const pineconeIndex = pinecone.Index(env.PINECONE_INDEX);
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: hostname,
  });

  console.log("Client connected");

  ws.on("message", async (message) => {
    console.log(`Received message from client: ${message}`);

    const question = message.toString();

    const documents = await vectorStore.similaritySearch(question, 10);
    let bigText = "";

    for (let i = 0; i < documents.length; i++) {
      let pageContent = documents[i].pageContent;
      bigText += pageContent.replace(/\n/g, " ");
    }

    const prompt = `You are an AI assistant who receives questions based on the content below.

Content: ###
${bigText}
###

Answer in the same language as the user's questions, be very detailed, giving as much information as possible.
`;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question },
      ],
      temperature: 0,
    });

    // Send a response back to the client
    ws.send(`${completion.data.choices[0].message?.content}`);
  });
});

app.get("/teste", (req, res) => {
  return "ok";
});

app.use("", routes);

server.listen(env.PORT, () =>
  console.log(`
🚀 Server ready at: http://localhost:${env.PORT}
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`)
);
