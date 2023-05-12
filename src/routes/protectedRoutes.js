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

export default router;
