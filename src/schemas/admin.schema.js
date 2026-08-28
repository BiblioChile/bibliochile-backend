import { z } from "zod";

const createQRCodeSchema = z.object({
  locationName: z.string().min(1, "El nombre de la ubicación es obligatorio"),
  gutendexId: z.number().int().positive("gutendexId debe ser un número entero positivo"),
});

const rejectAuthorSchema = z.object({
  reason: z.enum(["problema_sistema", "otro"], {
    message: "reason debe ser 'problema_sistema' u 'otro'",
  }),
  note: z.string().max(1000, "La nota no puede superar los 1000 caracteres").optional(),
});

export { createQRCodeSchema, rejectAuthorSchema };
