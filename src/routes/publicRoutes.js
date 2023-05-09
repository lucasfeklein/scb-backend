import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const router = express.Router();

router.post("/request-magic-link", async (req, res) => {
  const { email } = req.body; // get the email from the request body

  // Calculate the expiry time as the current time plus 30 minutes
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 30);

  const user = await prisma.user.upsert({
    where: {
      email: email,
    },
    update: {
      emailVerificationTokenExpiry: expiryTime,
      emailVerificationToken: uuidv4(),
    },
    create: {
      email: email,
      emailVerificationTokenExpiry: expiryTime,
      emailVerificationToken: uuidv4(),
    },
  });

  const magicLinkToken = user.emailVerificationToken;
  const magicLink = `http://localhost:3000/magic-link?token=${magicLinkToken}`;

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "lucas.fklein@hotmail.com",
      pass: env.EMAIL_PASSWORD,
    },
  });

  // Update the email options with the magic link and the recipient email
  const mailOptions = {
    from: "lucas.fklein@hotmail.com",
    to: email, // use the email from the request body
    subject: "Magic Link to Login",
    text: `Use this magic link to log in: ${magicLink}`,
  };

  console.log("Sending email...");
  console.log(mailOptions);

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).send("Error sending email");
    } else {
      console.log("Email sent: " + info.response);
      return res.send("Email sent successfully");
    }
  });
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

export default router;
