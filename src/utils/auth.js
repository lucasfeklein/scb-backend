import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Set your secret key, ideally in an environment variable
const SECRET_KEY = env.JWT_SECRET || "your-secret-key";

const authMiddleware = (req, res, next) => {
  // Extract the token from the request header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }

  // Check if the header starts with "Bearer "
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  // Extract the token without the "Bearer " prefix
  const token = authHeader.slice(7);

  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  // Verify the token using the secret key
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // If the token is valid, store the decoded payload in the request object
    req.userId = Number(decoded);
    next();
  });
};

export { authMiddleware };

