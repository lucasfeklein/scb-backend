import axios from "axios";
import { env } from "../config/env.js";

export async function sendEmail(user, magicLink) {
  const emailData = {
    sender: {
      name: "IAssistente",
      email: "suporte@iassistente.com",
    },
    to: [
      {
        email: user.email,
        name: user.name,
      },
    ],
    subject: "[IAssistente] Link de acesso",
    htmlContent: `<html><head></head><body><p>Olá${
      user.name ? ` ${user.name}` : ""
    },</p>Estamos felizes em fornecer acesso à nossa plataforma. Para fazer login com segurança, basta clicar no seguinte link:</p><a href='${magicLink}'>${magicLink}</p></body></html>`,
  };

  return axios
    .post("https://api.brevo.com/v3/smtp/email", emailData, {
      headers: {
        Accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
    })
    .then(function (response) {
      console.log("Email sent successfully:", response.data);
    })
    .catch(function (error) {
      console.error("Error sending email:", error.response.data);
      throw error;
    });
}
