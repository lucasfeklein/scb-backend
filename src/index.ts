import { Prisma, PrismaClient } from '@prisma/client';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'ws';



const prisma = new PrismaClient()
const app = express()

const server = createServer(app);
const wss = new Server({ server });


const chatHistory: Record<string, string[]> = {};


app.use(express.json())


wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { phoneNumber, text } = JSON.parse(message.toString());

    console.log(`Received message from ${phoneNumber}: ${text}`)

    // Check if there's an existing chat with the given phone number
    if (!chatHistory[phoneNumber]) {
      chatHistory[phoneNumber] = [];
    }

    console.log(chatHistory[phoneNumber])

    // Store the received message
    chatHistory[phoneNumber].push(text);

    // Here, you can implement the communication between the user and the LLM chatbot.
    // For simplicity, I'll just echo the message back to the user.
    const chatbotResponse = `LLM Chatbot: ${text}`;

    // Store the chatbot's response
    chatHistory[phoneNumber].push(chatbotResponse);

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
