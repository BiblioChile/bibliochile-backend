import { z } from "zod";

const progressSchema = z.object({
  bookId: z.number().int().positive("El bookId debe ser un número entero positivo"),
  progressPercentage: z.number().min(0).max(100, "El porcentaje debe estar entre 0 y 100"),
  lastPosition: z.string().optional(),
  anonymousUuid: z.string().uuid("UUID inválido").optional(),
});

const syncSchema = z.object({
  anonymousUuid: z.string().uuid("UUID inválido"),
});

export { progressSchema, syncSchema };