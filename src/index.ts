import { PineconeClient } from "@pinecone-database/pinecone";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import nodemailer from 'nodemailer';
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

app.post('/auth/request-magic-link', async (req, res) => {
  const { email } = req.body; // get the email from the request body

  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  const magicLinkToken = user?.emailVerificationToken;
  const magicLink = `https://example.com/auth/magic-link?token=${magicLinkToken}`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      user: 'lucas.fklein@hotmail.com',
      pass: 'llucas00'
    }
  });

  // Update the email options with the magic link and the recipient email
  const mailOptions: nodemailer.SendMailOptions = {
    from: 'lucas.fklein@hotmail.com',
    to: email, // use the email from the request body
    subject: 'Magic Link to Login',
    text: `Use this magic link to log in: ${magicLink}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).send('Error sending email');
    } else {
      console.log('Email sent: ' + info.response);
      res.send('Email sent successfully');
    }
  });
});

app.post(`/signup`, async (req, res) => {
});

server.listen(3000, () =>
  console.log(`
🚀 Server ready at: http://localhost:3000
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`)
);
