import express from "express";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../utils/auth.js";
import { processWebsite } from "../utils/crawler.js";

const router = express.Router();

router.post("/company", authMiddleware, async (req, res) => {
  const { name, website } = req.body;

  const url = new URL(website);

  const company = await prisma.company.upsert({
    where: {
      website: url.hostname,
    },
    update: {},
    create: {
      userId: req.userId,
      name: name,
      website: url.hostname,
    },
  });

  await processWebsite({
    hostname: url.hostname,
  });

  return res.json(company);
});

export default router;
