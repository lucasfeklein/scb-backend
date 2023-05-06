import { PrismaClient } from "@prisma/client";
import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router()
const prisma = new PrismaClient();

router.post('/request-magic-link', async (req, res) => {
    const { email } = req.body; // get the email from the request body

    const user = await prisma.user.findUnique({
        where: {
            email: email,
        },
    });

    const magicLinkToken = user?.emailVerificationToken;
    const magicLink = `https://example.com/auth/magic-link?token=${magicLinkToken}`;

    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
            user: 'lucas.fklein@hotmail.com',
            pass: 'llucas00'
        }
    });

    // Update the email options with the magic link and the recipient email
    const mailOptions: nodemailer.SendMailOptions = {
        from: 'lucas.fklein@hotmail.com',
        to: email, // use the email from the request body
        subject: 'Magic Link to Login',
        text: `Use this magic link to log in: ${magicLink}`
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

export default router