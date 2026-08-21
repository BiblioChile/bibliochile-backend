import { Router } from "express";
import { register, uploadMyBook, getMyBookStats } from "../controllers/author.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { registerAuthorSchema, uploadBookSchema } from "../schemas/author.schema.js";

const router = Router();

router.post("/register", verifyToken, validate(registerAuthorSchema), register);
router.post("/books", verifyToken, requireRole("autor"), validate(uploadBookSchema), uploadMyBook);
router.get("/me/stats", verifyToken, requireRole("autor"), getMyBookStats);

export default router;
