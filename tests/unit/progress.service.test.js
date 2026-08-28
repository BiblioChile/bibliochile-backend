// EC-PU-003 — Guardar / consultar progreso de lectura (src/services/progress.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-003-progreso-lectura.md
// EC-PU-008 — Migración de progreso anónimo (syncProgress)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-008-migracion-progreso.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    readingProgress: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    book: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("../../src/services/book.service.js", () => ({
  getBookById: vi.fn(),
}));

import { prisma } from "../../src/prisma/client.js";
import { getBookById } from "../../src/services/book.service.js";
import { saveProgress, getProgress, syncProgress } from "../../src/services/progress.service.js";
import { progressSchema, syncSchema } from "../../src/schemas/progress.schema.js";

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

  it("Escenario 4 (libro gratuito nuevo): se sincroniza automáticamente desde Gutendex y crea el Book por gutendex_id", async () => {
    // El libro no existe localmente ni por id interno ni por gutendex_id
    prisma.book.findUnique.mockResolvedValue(null);
    getBookById.mockResolvedValue({
      id: 55465,
      title: "Martín Rivas",
      content_url: "https://gutendex.com/books/55465.html",
      cover_url: "https://gutendex.com/covers/55465.jpg",
      description: "Novela costumbrista chilena.",
    });
    // El id interno (autoincrement) es independiente del id de Gutendex
    prisma.book.upsert.mockResolvedValue({ id: 501, gutendex_id: 55465, is_free: true });
    prisma.readingProgress.upsert.mockResolvedValue({
      id: 2,
      user_id: 7,
      book_id: 501,
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
    expect(prisma.book.findUnique).toHaveBeenNthCalledWith(1, { where: { id: 55465 } });
    expect(prisma.book.findUnique).toHaveBeenNthCalledWith(2, { where: { gutendex_id: 55465 } });
    expect(prisma.book.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gutendex_id: 55465 },
        create: expect.objectContaining({ gutendex_id: 55465, title: "Martín Rivas", is_free: true }),
      })
    );
    // El FK de ReadingProgress usa el id interno del Book, no el de Gutendex
    expect(prisma.readingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id_book_id: { user_id: 7, book_id: 501 } },
      })
    );
    expect(result.book_id).toBe(501);
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

describe("EC-PU-003 · progress.service.getProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): usuario autenticado obtiene su progreso mapeado, con fallback de autor", async () => {
    prisma.readingProgress.findMany.mockResolvedValue([
      {
        book_id: 55465,
        progress_percentage: 42,
        last_position: "42%",
        updated_at: new Date("2026-08-01T00:00:00.000Z"),
        book: {
          id: 55465,
          title: "Martín Rivas",
          cover_url: "https://gutendex.com/covers/55465.jpg",
          author: null,
          publicDomainAuthor: { name: "Alberto Blest Gana" },
        },
      },
      {
        book_id: 90,
        progress_percentage: 10,
        last_position: "10%",
        updated_at: new Date("2026-08-02T00:00:00.000Z"),
        book: {
          id: 90,
          title: "Libro Nacional",
          cover_url: "https://bibliochile.cl/covers/90.jpg",
          author: { user: { name: "Autor Nacional" } },
          publicDomainAuthor: null,
        },
      },
    ]);

    const result = await getProgress({ userId: 7, anonymousUuid: null });

    expect(prisma.readingProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 7, progress_percentage: { lt: 100 } },
        orderBy: { updated_at: "desc" },
      })
    );
    expect(result).toEqual([
      {
        bookId: 55465,
        progressPercentage: 42,
        lastPosition: "42%",
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        book: {
          id: 55465,
          title: "Martín Rivas",
          author: "Alberto Blest Gana",
          cover_url: "https://gutendex.com/covers/55465.jpg",
        },
      },
      {
        bookId: 90,
        progressPercentage: 10,
        lastPosition: "10%",
        updatedAt: new Date("2026-08-02T00:00:00.000Z"),
        book: {
          id: 90,
          title: "Libro Nacional",
          author: "Autor Nacional",
          cover_url: "https://bibliochile.cl/covers/90.jpg",
        },
      },
    ]);
  });

  it("Escenario 2 (caso inválido): sin userId ni anonymousUuid, rechaza la consulta", async () => {
    await expect(getProgress({ userId: null, anonymousUuid: null })).rejects.toThrow(
      "Se requiere userId o anonymousUuid"
    );
    expect(prisma.readingProgress.findMany).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): usuario anónimo sin progreso guardado recibe lista vacía", async () => {
    prisma.readingProgress.findMany.mockResolvedValue([]);

    const result = await getProgress({ userId: null, anonymousUuid: "uuid-anon-1" });

    expect(prisma.readingProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { anonymous_uuid: "uuid-anon-1", progress_percentage: { lt: 100 } },
      })
    );
    expect(result).toEqual([]);
  });
});

describe("EC-PU-008 · progress.service.syncProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): migra el progreso anónimo hacia la cuenta autenticada", async () => {
    prisma.readingProgress.updateMany.mockResolvedValue({ count: 2 });

    const result = await syncProgress(7, "uuid-anon-1");

    expect(prisma.readingProgress.updateMany).toHaveBeenCalledWith({
      where: { anonymous_uuid: "uuid-anon-1" },
      data: { user_id: 7, anonymous_uuid: null },
    });
    expect(result).toEqual({ synced: 2 });
  });

  it("Escenario 2 (caso inválido): error de Prisma en updateMany se propaga sin ser capturado", async () => {
    prisma.readingProgress.updateMany.mockRejectedValue(new Error("DB connection error"));

    await expect(syncProgress(7, "uuid-anon-1")).rejects.toThrow("DB connection error");
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza anonymousUuid ausente", () => {
    const result = syncSchema.safeParse({});

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["anonymousUuid"]));
  });
});
