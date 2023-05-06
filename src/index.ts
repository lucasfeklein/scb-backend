import { PineconeClient } from "@pinecone-database/pinecone";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { Configuration, OpenAIApi } from "openai";
import { Server } from "ws";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const embeddings = new OpenAIEmbeddings();
const client = new PineconeClient();

const prisma = new PrismaClient();
const app = express();

const server = createServer(app);
const wss = new Server({ server });

app.use(express.json());

async function handleInit(phoneNumber: string) {
  const user = await prisma.user.upsert({
    where: {
      phone: phoneNumber,
    },
    update: {},
    create: {
      phone: phoneNumber,
    },
  });

  return await prisma.message.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

wss.on("connection", async (ws) => {
  console.log('Client connected.');

  await client.init({
    apiKey: process.env.PINECONE_API_KEY as string,
    environment: process.env.PINECONE_API_ENV as string,
  });
  const pineconeIndex = client.Index(process.env.PINECONE_INDEX as string);
  const vectorStore = await PineconeStore.fromExistingIndex(
    embeddings,
    { pineconeIndex, namespace: "https://dynamicpoa.com/" }
  );

  // Send a message to the client when it connects
  ws.send('Hello! How can I assist you today?');

  ws.on("message", async (message) => {
    console.log(`Received message from client: ${message}`);

    const question = message.toString()

    const documents = await vectorStore.similaritySearch(question, 10)
    let bigText = ""

    for (let i = 0; i < documents.length; i++) {
      let pageContent = documents[i].pageContent
      bigText += pageContent.replace(/\n/g, " ")
    }

    const prompt = `You are an AI assistant who receives questions based on the content below.

Content: ###
${bigText}
###

Answer in the same language as the user's questions, be very detailed, giving as much information as possible.
`

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question }
      ],
      temperature: 0,
    });

    // Send a response back to the client
    ws.send(`${completion.data.choices[0].message?.content}`);
  });
});

app.post(`/signup`, async (req, res) => {
  const { phone } = req.body;

  const result = await prisma.user.create({
    data: {
      phone,
    },
  });
  res.json(result);
});

server.listen(3000, () =>
  console.log(`
🚀 Server ready at: http://localhost:3000
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`)
);
