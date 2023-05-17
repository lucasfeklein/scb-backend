import * as dotenv from "dotenv";

dotenv.config();

const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_API_ENV: process.env.PINECONE_API_ENV,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
};

export { env };
