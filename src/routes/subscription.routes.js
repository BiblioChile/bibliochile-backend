import { Router } from "express";
import { listPlans, subscribe, getActiveSubscription, changePlan } from "../controllers/subscription.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { subscriptionSchema } from "../schemas/subscription.schema.js";

const router = Router();

router.get("/plans", listPlans);
router.get("/me", verifyToken, getActiveSubscription);
router.post("/", verifyToken, validate(subscriptionSchema), subscribe);
// Cambiar de plan con una suscripción vigente (upgrade/downgrade sin
// prorrateo): mismo body que POST, requiere auth igual que POST.
router.patch("/", verifyToken, validate(subscriptionSchema), changePlan);

export default router;