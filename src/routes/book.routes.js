import { Router } from "express";
import { getAllBooks, getBook } from "../controllers/book.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", optionalAuth, getAllBooks);
router.get("/:id", optionalAuth, getBook);

export default router;