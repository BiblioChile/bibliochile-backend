import { Router } from "express";
import { getAllBooks, getBook, getAllPaidBooks } from "../controllers/book.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", optionalAuth, getAllBooks);
// Debe ir antes de "/:id" — si no, Express interpreta "paid" como el
// parámetro :id y esta ruta nunca se alcanza.
router.get("/paid", getAllPaidBooks);
router.get("/:id", optionalAuth, getBook);

export default router;