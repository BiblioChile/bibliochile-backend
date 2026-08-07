import { Router } from "express";
import { rentBook, listMyRentals } from "../controllers/rental.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { rentalSchema } from "../schemas/rental.schema.js";

const router = Router();

router.post("/", verifyToken, validate(rentalSchema), rentBook);
router.get("/me", verifyToken, listMyRentals);

export default router;
