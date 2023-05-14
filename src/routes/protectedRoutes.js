import express from "express";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../utils/auth.js";
import {
  crawlCheerio,
  crawlSitemap,
  processWebsite,
} from "../utils/crawler.js";

const router = express.Router();

router.post("/company", authMiddleware, async (req, res) => {
  const { name, website } = req.body;
  console.log("1");
  const url = new URL(website);
  console.log("2");
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
  console.log("3");
  await processWebsite({
    hostname: url.hostname,
  });
  console.log("4");
  return res.json(company);
});

router.get("/auth-verify", authMiddleware, async (req, res) => {
  try {
    // Find the user in the database by the userId in the JWT token
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the emailVerificationTokenExpiry has expired
    if (user.emailVerificationTokenExpiry < Date.now()) {
      return res
        .status(401)
        .json({ message: "Email verification token has expired" });
    }

    // Email verification token is still valid, send back the email
    return res.status(200).json({ email: user.email });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/fetch-urls", authMiddleware, async (req, res) => {
  const { website } = req.body;
  try {
    let urls = await crawlSitemap(website);
    if (urls) {
      res.status(200).json({ urls });
    } else {
      urls = await crawlCheerio(website);
      res.status(200).json({ urls });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err });
  }
});

export default router;
