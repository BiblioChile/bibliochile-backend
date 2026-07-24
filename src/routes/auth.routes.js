import { Router } from "express";
import { registerUser, loginUser } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import schemas from "../schemas/auth.schema.js";

const router = Router();
const { loginSchema, registerSchema } = schemas

router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);

export default router;