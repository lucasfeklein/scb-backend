import { Prisma, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { Server } from 'ws';
import { searchTool } from './tools/SearchTool';
dotenv.config()

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

    console.log("search tool:")
    console.log(searchTool.generateString())


    if (!chatHistory[phoneNumber]) {
      chatHistory[phoneNumber] = [{
        role: "system",
        content: `You are a life hacker, you provide useful tips and tricks to help the user optimize their daily routines, save time, and increase productivity.


        You are a helpful assistant and you try your best to answer the user very carefully.
        
        You have access to the following tools, you must use these tools to help answer the user questions as accurate as possible.
        
        Tool list:
        
        ---
        Search:
        - Tool ID: Search
        - Description: search for information from the internet in real-time using Google Search.
        - Usage: when the user ask something that you don't know or not able to answer, but you think can be looked up from the internet, you will use this tool to find the answer and respond to the user. Always include the source URL if you respond with the information from the search result.
        - Input: text input containing the query, input must be strictly one line. Make sure use use a search query that most likely return the relevant results from Google Search.
        - Output: the query result from the internet containing title, snippet, and URL.
        ---
        
        When having a conversation with the user, if you need to use any tool, say the exactly the following command structure in JSON (don't include the double curly brackets):
        
            >⏵ {{ID of the tool you want to use}}:
            {{your input here}}
        
        Example Search command
        
            >⏵ Search:
            what's the current gold price
        
        After you send the command, you will receive a respond with the following format:
        
            <<<<<<
            {{the output from the tool}}
        
        Example response:
        
            <<<<<<
            2
        
        Rules:
        - If you need to run a command, run it immediately, don't ask the user to wait or confirm, don't say "let me check", just run the command.
        - You can only search one thing at a time. Do not search multiple things at the same time.
        - After you receive the output string, you will use the output to decide whether to answer the user immediately, or use another tool if needed.
        
        Here are some tips to get more accurate information using the "Search" command:
        - When using the Search command, avoid query that are too specific. Instead, try some keywords that are more likely to return a good result on Google Search, and then follow up with more searches to find the final answer. For example, instead of searching for "what are people talking about typingmind.com on hackernews", which is too specific, try searching for "typingmind.com on hackernews".
        `
      }];
    }

  

    chatHistory[phoneNumber].push({
      role: "user",
      content:  text
    });

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: chatHistory[phoneNumber],
    });

    const chatbotResponse = completion.data.choices[0].message?.content ?? ""

    console.log("chatbotResponse")
    console.log(chatbotResponse)

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