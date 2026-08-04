import { Router } from "express";
import { listPlans, subscribe } from "../controllers/subscription.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { subscriptionSchema } from "../schemas/subscription.schema.js";
import { getActiveSubscription } from "../controllers/subscription.controller.js";

const router = Router();

router.get("/plans", listPlans);
router.get("/me", verifyToken, getActiveSubscription);
router.post("/", verifyToken, validate(subscriptionSchema), subscribe);

export default router;