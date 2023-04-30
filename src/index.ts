import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import { Server } from "ws";
dotenv.config();

const prisma = new PrismaClient();
const app = express();

const server = createServer(app);
const wss = new Server({ server });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    const { action, phoneNumber, text } = JSON.parse(message.toString());

    if (action === "init") {
      const messages = await handleInit(phoneNumber);
      return ws.send(
        JSON.stringify({
          messages,
        })
      );
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        phone: phoneNumber,
      },
    });

    await prisma.message.create({
      data: {
        content: text,
        role: "user",
        userId: user.id,
      },
    });

    const previousMessages = await prisma.message.findMany({
      where: {
        userId: user.id,
      },
    });

    console.log("previousMessages");
    console.log(previousMessages);

    const chatHistory: ChatCompletionRequestMessage[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant that is also fanatic with the Brazilian team Grêmio. You mention Grêmio all the time",
      },
      ...previousMessages.map((message) => ({
        role: message.role as "user" | "assistant" | "system",
        content: message.content,
      })),
    ];

    console.log("chatHistory");
    console.log(chatHistory);

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: chatHistory,
    });

    const chatbotResponse = completion.data.choices[0].message?.content ?? "";

    console.log("chatbotResponse");
    console.log(chatbotResponse);

    await prisma.message.create({
      data: {
        content: chatbotResponse,
        role: "assistant",
        userId: user.id,
      },
    }),
      // Send the response back to the user
      ws.send(JSON.stringify({ response: chatbotResponse }));
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
