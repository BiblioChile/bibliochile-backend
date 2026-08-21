// EC-PU-009 — Perfil de autor: registro, subida de obra y estadísticas (src/services/author.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-009-perfil-autor.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    author: { findUnique: vi.fn(), create: vi.fn() },
    book: { create: vi.fn(), findMany: vi.fn() },
    readingProgress: { findMany: vi.fn() },
    rental: { count: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { registerAuthor, getAuthorByUserId, uploadBook, getMyStats } from "../../src/services/author.service.js";
import { registerAuthorSchema, uploadBookSchema, isValidRut } from "../../src/schemas/author.schema.js";

const VALID_RUT = "12345678-5";

describe("EC-PU-009 · author.service.registerAuthor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): crea el registro de autor en estado pendiente", async () => {
    prisma.author.findUnique.mockResolvedValue(null);
    prisma.author.create.mockResolvedValue({
      id: 1,
      user_id: 7,
      rut: VALID_RUT,
      bio: "Escritor chileno",
      status: "pendiente",
      declaration_accepted: true,
    });

    const result = await registerAuthor(7, VALID_RUT, "Escritor chileno", true);

    expect(result.status).toBe("pendiente");
    expect(prisma.author.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 7,
          rut: VALID_RUT,
          status: "pendiente",
          declaration_accepted: true,
        }),
      })
    );
  });

  it("Escenario 2 (caso inválido): sin aceptar la declaración jurada, rechaza el registro", async () => {
    await expect(registerAuthor(7, VALID_RUT, "bio", false)).rejects.toThrow(
      "Debes aceptar la declaración jurada"
    );
    expect(prisma.author.create).not.toHaveBeenCalled();
  });

  it("Escenario 2b (caso inválido): usuario que ya tiene un registro de autor, lo rechaza", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, user_id: 7 });

    await expect(registerAuthor(7, VALID_RUT, "bio", true)).rejects.toThrow(
      "Ya tienes un registro de autor"
    );
    expect(prisma.author.create).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza rut, y declarationAccepted ausentes", () => {
    const result = registerAuthorSchema.safeParse({});

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["rut", "declarationAccepted"]));
  });
});

describe("EC-PU-009 · author.schema.isValidRut", () => {
  it("valida un RUT chileno correcto, con y sin puntos", () => {
    expect(isValidRut("12345678-5")).toBe(true);
    expect(isValidRut("12.345.678-5")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(isValidRut("12345678-9")).toBe(false);
  });
});

describe("EC-PU-009 · author.service.uploadBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): autor aprobado sube una obra correctamente", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "aprobado" });
    prisma.book.create.mockResolvedValue({
      id: 501,
      title: "Mi novela",
      author_id: 1,
      is_free: false,
    });

    const result = await uploadBook(1, {
      title: "Mi novela",
      contentUrl: "https://bibliochile.cl/books/mi-novela.html",
    });

    expect(result.id).toBe(501);
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Mi novela", author_id: 1, is_free: false }),
      })
    );
  });

  it("Escenario 2 (caso inválido): autor pendiente de aprobación, rechaza la subida", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "pendiente" });

    await expect(
      uploadBook(1, { title: "Mi novela", contentUrl: "https://bibliochile.cl/books/mi-novela.html" })
    ).rejects.toThrow("Tu cuenta de autor aún no ha sido aprobada");
    expect(prisma.book.create).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza title y contentUrl ausentes", () => {
    const result = uploadBookSchema.safeParse({});

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["title", "contentUrl"]));
  });
});

describe("EC-PU-009 · author.service.getMyStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): calcula lectores únicos, progreso promedio y arriendos de las obras del autor", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "aprobado" });
    prisma.book.findMany.mockResolvedValue([{ id: 501 }, { id: 502 }]);
    prisma.readingProgress.findMany.mockResolvedValue([
      { user_id: 7, anonymous_uuid: null, progress_percentage: 40 },
      { user_id: null, anonymous_uuid: "uuid-anon-1", progress_percentage: 60 },
      { user_id: 7, anonymous_uuid: null, progress_percentage: 80 },
    ]);
    prisma.rental.count.mockResolvedValue(3);

    const result = await getMyStats(1);

    expect(result.totalBooks).toBe(2);
    expect(result.totalReaders).toBe(2); // usuario 7 se cuenta una sola vez
    expect(result.avgProgressPercentage).toBeCloseTo(60, 5);
    expect(result.totalRentals).toBe(3);
  });

  it("Escenario 2 (caso inválido): autor sin registro, rechaza la consulta", async () => {
    prisma.author.findUnique.mockResolvedValue(null);

    await expect(getMyStats(999)).rejects.toThrow("Autor no encontrado");
  });

  it("Escenario 3 (campos vacíos): autor sin obras publicadas, retorna estadísticas en cero", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "aprobado" });
    prisma.book.findMany.mockResolvedValue([]);

    const result = await getMyStats(1);

    expect(result).toEqual({
      totalBooks: 0,
      totalReaders: 0,
      avgProgressPercentage: 0,
      totalRentals: 0,
    });
    expect(prisma.readingProgress.findMany).not.toHaveBeenCalled();
  });
});

describe("EC-PU-009 · author.service.getAuthorByUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): retorna el Author asociado al userId", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, user_id: 7, status: "aprobado" });

    const result = await getAuthorByUserId(7);

    expect(result.id).toBe(1);
  });

  it("Escenario 2 (caso inválido): usuario sin registro de autor, rechaza la búsqueda", async () => {
    prisma.author.findUnique.mockResolvedValue(null);

    await expect(getAuthorByUserId(7)).rejects.toThrow("No tienes un registro de autor");
  });
});
