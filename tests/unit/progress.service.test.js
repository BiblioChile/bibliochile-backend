// EC-PU-003 — Guardar progreso de lectura (src/services/progress.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-003-progreso-lectura.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    readingProgress: { upsert: vi.fn() },
    book: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("../../src/services/book.service.js", () => ({
  getBookById: vi.fn(),
}));

import { prisma } from "../../src/prisma/client.js";
import { getBookById } from "../../src/services/book.service.js";
import { saveProgress } from "../../src/services/progress.service.js";
import { progressSchema } from "../../src/schemas/progress.schema.js";

describe("EC-PU-003 · progress.service.saveProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): usuario autenticado guarda su progreso correctamente", async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 123, is_free: true });
    prisma.readingProgress.upsert.mockResolvedValue({
      id: 1,
      user_id: 7,
      book_id: 123,
      progress_percentage: 42,
      last_position: "42%",
    });

    const result = await saveProgress({
      userId: 7,
      anonymousUuid: null,
      bookId: 123,
      progressPercentage: 42,
      lastPosition: "42%",
    });

    expect(result.progress_percentage).toBe(42);
    expect(prisma.readingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id_book_id: { user_id: 7, book_id: 123 } },
        update: expect.objectContaining({ progress_percentage: 42 }),
      })
    );
  });

  it("Escenario 2 (caso inválido): sin userId ni anonymousUuid, rechaza el guardado", async () => {
    await expect(
      saveProgress({ userId: null, anonymousUuid: null, bookId: 123, progressPercentage: 50 })
    ).rejects.toThrow("Se requiere user_id o anonymous_uuid");
    expect(prisma.readingProgress.upsert).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza bookId y progressPercentage ausentes", () => {
    const result = progressSchema.safeParse({});

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["bookId", "progressPercentage"]));
  });

  it("Escenario 4 (libro gratuito nuevo): se sincroniza automáticamente desde Gutendex y crea el Book", async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    getBookById.mockResolvedValue({
      id: 55465,
      title: "Martín Rivas",
      content_url: "https://gutendex.com/books/55465.html",
      cover_url: "https://gutendex.com/covers/55465.jpg",
      description: "Novela costumbrista chilena.",
    });
    prisma.book.upsert.mockResolvedValue({ id: 55465, is_free: true });
    prisma.readingProgress.upsert.mockResolvedValue({
      id: 2,
      user_id: 7,
      book_id: 55465,
      progress_percentage: 10,
    });

    const result = await saveProgress({
      userId: 7,
      anonymousUuid: null,
      bookId: 55465,
      progressPercentage: 10,
      lastPosition: "10%",
    });

    expect(getBookById).toHaveBeenCalledWith(55465);
    expect(prisma.book.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55465 },
        create: expect.objectContaining({ id: 55465, title: "Martín Rivas", is_free: true }),
      })
    );
    expect(result.book_id).toBe(55465);
  });

  it("Escenario 5 (libro gratuito ya existente): no vuelve a crear el Book", async () => {
    prisma.book.findUnique.mockResolvedValue({ id: 55465, is_free: true });
    prisma.readingProgress.upsert.mockResolvedValue({
      id: 3,
      user_id: 7,
      book_id: 55465,
      progress_percentage: 20,
    });

    await saveProgress({
      userId: 7,
      anonymousUuid: null,
      bookId: 55465,
      progressPercentage: 20,
      lastPosition: "20%",
    });

    expect(getBookById).not.toHaveBeenCalled();
    expect(prisma.book.upsert).not.toHaveBeenCalled();
  });

  it("Escenario 6 (libro de pago inexistente): falla sin crear nada", async () => {
    prisma.book.findUnique.mockResolvedValue(null);
    getBookById.mockRejectedValue(new Error("Libro no encontrado"));

    await expect(
      saveProgress({ userId: 7, anonymousUuid: null, bookId: 999, progressPercentage: 5 })
    ).rejects.toThrow("Libro no encontrado");

    expect(prisma.book.upsert).not.toHaveBeenCalled();
    expect(prisma.readingProgress.upsert).not.toHaveBeenCalled();
  });
});
