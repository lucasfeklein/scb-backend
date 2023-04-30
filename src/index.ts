import { Prisma, PrismaClient } from '@prisma/client';
import express from 'express';
import { createServer } from 'http';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { Server } from 'ws';

const prisma = new PrismaClient()
const app = express()

const server = createServer(app);
const wss = new Server({ server });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);



const chatHistory: Record<string, Array<ChatCompletionRequestMessage>> = {};


app.use(express.json())


wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const { phoneNumber, text } = JSON.parse(message.toString());

    console.log(`Received message from ${phoneNumber}: ${text}`)


    if (!chatHistory[phoneNumber]) {
      chatHistory[phoneNumber] = [];
    }

    console.log(chatHistory[phoneNumber])


    chatHistory[phoneNumber].push({
      role: "user",
      content:  text
    });

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: chatHistory[phoneNumber],
    });

    const chatbotResponse = completion.data.choices[0].message?.content ?? ""

    // Store the chatbot's response
    chatHistory[phoneNumber].push({
      content: chatbotResponse,
      role: "assistant"
    });

    // Send the response back to the user
    ws.send(chatbotResponse);
  });
});


app.post(`/signup`, async (req, res) => {
  const { name, email, posts } = req.body

  const postData = posts?.map((post: Prisma.PostCreateInput) => {
    return { title: post?.title, content: post?.content }
  })

  const result = await prisma.user.create({
    data: {
      name,
      email,
      posts: {
        create: postData,
      },
    },
  })
  res.json(result)
})


server.listen(3000, () =>
  console.log(`
🚀 Server ready at: http://localhost:3000
⭐️ See sample requests: http://pris.ly/e/ts/rest-express#3-using-the-rest-api`),
)
