import { Router } from "express";
import { scanQR } from "../controllers/qr.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js"

const router = Router();

router.get("/:code", optionalAuth, scanQR);

export default router