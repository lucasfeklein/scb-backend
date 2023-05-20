import express from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { priceToPlan } from "../utils/plans.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

router.post("/request-magic-link", async (req, res) => {
  const { email } = req.body; // get the email from the request body

  try {
    await prisma.user.findUniqueOrThrow({
      where: {
        email: email,
      },
    });

    const token = uuidv4();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    const user = await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        emailVerificationTokenExpiry: expiryTime,
        emailVerificationToken: token,
      },
    });

    const magicLink = `${env.FRONTEND_URL}/magic-link?token=${token}`;

    await sendEmail(user, magicLink);

    return res.status(200).json({
      message: "ok",
    });
  } catch (err) {
    return res.status(400).json(err);
  }
});

router.get("/", (req, res) => {
  return res.status(200).json({ message: "ok" });
});

router.post("/verify-magic-link", async (req, res) => {
  const { token } = req.body;

  // Find the user with the matching emailVerificationToken
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
    },
  });

  if (!user) {
    return res.status(400).json({ error: "Invalid token" });
  }

  // Check if the emailVerificationTokenExpiry has passed
  const now = new Date();
  if (
    user.emailVerificationTokenExpiry &&
    user.emailVerificationTokenExpiry < now
  ) {
    return res.status(400).json({ error: "Token has expired" });
  }

  // Create a JWT with the user's ID and email as the payload
  const payload = user.id.toString();
  const jwtSecret = env.JWT_SECRET; // replace with your own secret
  const tokenJwt = jwt.sign(payload, jwtSecret);

  // Respond with the JWT
  return res.json({ token: tokenJwt });
});

router.post("/stripe", async (req, res) => {
  const { data } = req.body;

  if (data.object.billing_reason !== "subscription_create") {
    return res.status(200).json({ message: "ok" });
  }

  const priceId = data.object.lines.data[0].price.id;
  const customerEmail = data.object.customer_email;

  const token = uuidv4();
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 30);

  const user = await prisma.user.create({
    data: {
      email: customerEmail,
      emailVerificationTokenExpiry: expiryTime,
      emailVerificationToken: token,
      plan: priceToPlan[priceId],
    },
  });

  const magicLink = `${env.FRONTEND_URL}/magic-link?token=${token}`;

  await sendEmail(user, magicLink);

  return res.status(200).json({ message: "ok" });
});

export default router;
