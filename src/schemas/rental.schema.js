import { z } from "zod";

const rentalSchema = z.object({
  bookId: z.number().int().positive("El bookId debe ser un número entero positivo"),
});

export { rentalSchema };
