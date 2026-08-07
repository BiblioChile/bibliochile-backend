import { z } from "zod";

const subscriptionSchema = z.object({
  planId: z.number().int().positive("El plan debe ser un número entero positivo"),
});

export { subscriptionSchema };