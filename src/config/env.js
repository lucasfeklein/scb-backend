import * as dotenv from "dotenv";

dotenv.config();

const env = {
  OPEN_AI_API_KEY: process.env.OPENAI_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_API_ENV: process.env.PINECONE_API_ENV,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
};

export { env };
