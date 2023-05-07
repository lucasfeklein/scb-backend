import express from "express";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../utils/auth.js";

const router = express.Router();

router.post("/company", authMiddleware, async (req, res) => {
  const { name, website } = req.body;

  console.log(req);
  console.log(req.userId);

  const company = await prisma.company.upsert({
    where: {
      website: website,
    },
    update: {},
    create: {
      userId: req.userId,
      name: name,
      website: website,
    },
  });

  return res.json(company);
});

export default router;
