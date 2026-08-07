import { Router } from "express";
import { saveReadingProgress, getReadingProgress, syncReadingProgress } from "../controllers/progress.controller.js";
import { verifyToken, optionalAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { progressSchema, syncSchema } from "../schemas/progress.schema.js";

const router = Router();

router.get("/", optionalAuth, getReadingProgress);
router.post("/", optionalAuth, validate(progressSchema), saveReadingProgress);
router.post("/sync", verifyToken, validate(syncSchema), syncReadingProgress);

export default router;