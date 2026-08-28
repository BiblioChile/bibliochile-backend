import { Router } from "express";
import { register, uploadMyBook, getMyBookStats, getMyAuthorStatusHandler } from "../controllers/author.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { registerAuthorSchema, uploadBookSchema } from "../schemas/author.schema.js";

const router = Router();

router.post("/register", verifyToken, validate(registerAuthorSchema), register);
// Solo verifyToken (no requireRole) — a diferencia de /me/stats, esta ruta
// debe funcionar ANTES de la aprobación, para que el frontend pueda mostrar
// el estado real de la postulación (pendiente/rechazado con motivo) sin que
// requireRole("autor") la bloquee mientras el usuario sigue siendo "pasajero".
router.get("/me", verifyToken, getMyAuthorStatusHandler);
router.post("/books", verifyToken, requireRole("autor"), validate(uploadBookSchema), uploadMyBook);
router.get("/me/stats", verifyToken, requireRole("autor"), getMyBookStats);

export default router;
