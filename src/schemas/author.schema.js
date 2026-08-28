import { z } from "zod";

// Valida formato y dígito verificador de un RUT chileno.
// Acepta con o sin puntos y con guión antes del DV (ej. "12.345.678-9" o "12345678-9").
const isValidRut = (rutRaw) => {
  const clean = rutRaw.replace(/\./g, "").replace(/-/g, "").toUpperCase();

  if (!/^\d{7,8}[0-9K]$/.test(clean)) {
    return false;
  }

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  return dv === expectedDv;
};

const registerAuthorSchema = z.object({
  rut: z.string().refine(isValidRut, "RUT chileno inválido"),
  bio: z.string().max(1000, "La biografía no puede superar los 1000 caracteres").optional(),
  declarationAccepted: z.literal(true, "Debes aceptar la declaración jurada"),
});

const uploadBookSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  contentUrl: z.string().url("content_url debe ser una URL válida"),
  coverUrl: z.string().url("cover_url debe ser una URL válida").optional(),
  description: z.string().max(2000, "La descripción no puede superar los 2000 caracteres").optional(),
  genreIds: z.array(z.number().int().positive()).optional(),
});

export { registerAuthorSchema, uploadBookSchema, isValidRut };
