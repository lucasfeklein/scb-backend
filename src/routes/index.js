import express from "express";
import protectedRoutes from "./protectedRoutes.js";
import publicRoutes from "./publicRoutes.js";

const router = express.Router();

router.use("/", publicRoutes);
router.use("/", protectedRoutes);

export default router;
