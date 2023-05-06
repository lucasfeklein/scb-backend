import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import express from 'express';
import nodemailer from 'nodemailer';

dotenv.config()

const router = express.Router()
const prisma = new PrismaClient();

router.post('/request-magic-link', async (req, res) => {
    const { email } = req.body; // get the email from the request body

    let user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email: email,
            },
        });
    }

    // Calculate the expiry time as the current time plus 30 minutes
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    // Update the user with the new expiry time
    user = await prisma.user.update({
        where: {
            email: email,
        },
        data: {
            emailVerificationTokenExpiry: expiryTime,
        },
    });

    const magicLinkToken = user.emailVerificationToken;
    const magicLink = `https://example.com/auth/magic-link?token=${magicLinkToken}`;

    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
            user: 'lucas.fklein@hotmail.com',
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    // Update the email options with the magic link and the recipient email
    const mailOptions: nodemailer.SendMailOptions = {
        from: 'lucas.fklein@hotmail.com',
        to: email, // use the email from the request body
        subject: 'Magic Link to Login',
        text: `Use this magic link to log in: ${magicLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error sending email');
        } else {
            console.log('Email sent: ' + info.response);
            res.send('Email sent successfully');
        }
    });
});

router.post('/verify-token', async (req, res) => {
    const { token } = req.body;

    // Find the user with the matching emailVerificationToken
    const user = await prisma.user.findFirst({
        where: {
            emailVerificationToken: token,
        },
    });

    if (!user) {
        return res.status(400).json({ error: 'Invalid token' });
    }

    // Check if the emailVerificationTokenExpiry has passed
    const now = new Date();
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < now) {
        return res.status(400).json({ error: 'Token has expired' });
    }

    // Respond with the user ID so the client can create a JWT or session for authentication
    return res.json({ userId: user.id });
});
export default router