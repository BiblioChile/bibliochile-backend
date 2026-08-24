import { Router } from "express";
import {
    getManagedBooks,
    postQRCode,
    getQRCodes,
    patchQRCode,
    getPendingAuthors,
    patchApproveAuthor,
    patchRejectAuthor,
} from "../controllers/admin.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { createQRCodeSchema, rejectAuthorSchema } from "../schemas/admin.schema.js";

const router = Router();

router.get("/books", verifyToken, requireRole("admin"), getManagedBooks);

router.post("/qrcodes", verifyToken, requireRole("admin"), validate(createQRCodeSchema), postQRCode);
router.get("/qrcodes", verifyToken, requireRole("admin"), getQRCodes);
router.patch("/qrcodes/:id", verifyToken, requireRole("admin"), patchQRCode);

router.get("/authors/pending", verifyToken, requireRole("admin"), getPendingAuthors);
router.patch("/authors/:id/approve", verifyToken, requireRole("admin"), patchApproveAuthor);
router.patch(
    "/authors/:id/reject",
    verifyToken,
    requireRole("admin"),
    validate(rejectAuthorSchema),
    patchRejectAuthor
);

export default router;
