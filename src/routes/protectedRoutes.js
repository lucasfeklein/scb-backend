import express from "express";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../utils/auth.js";
import { crawlWebsite, processWebsite } from "../utils/crawler.js";

const router = express.Router();

router.post("/onboarding", authMiddleware, async (req, res) => {
  const { name, companyName } = req.body;

  await prisma.user.update({
    where: {
      id: req.userId,
    },
    data: {
      name: name,
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: req.userId,
      name: companyName,
    },
  });

  return res.json(company);
});

router.post("/widget", authMiddleware, async (req, res) => {
  const { companyId, urls } = req.body;

  const url = new URL(urls[0].url);
  const hostname = url.hostname;

  try {
    await prisma.company.update({
      where: {
        id: companyId,
      },
      data: {
        website: hostname,
      },
    });

    await processWebsite(urls, hostname);

    const company = await prisma.company.update({
      where: {
        id: companyId,
      },
      data: {
        isReady: true,
      },
    });

    return res.json(company);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err });
  }
});

router.get("/auth-verify", authMiddleware, async (req, res) => {
  try {
    // Find the user in the database by the userId in the JWT token
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Email verification token is still valid, send back the email
    return res
      .status(200)
      .json({ email: user.email, name: user.name, company: user.company });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/fetch-urls", authMiddleware, async (req, res) => {
  const { website } = req.query;
  try {
    const urls = await crawlWebsite(website);
    res.status(200).json({ urls });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
  }
});

export default router;
