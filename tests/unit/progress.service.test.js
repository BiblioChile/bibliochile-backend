// EC-PU-003 — Guardar progreso de lectura (src/services/progress.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-003-progreso-lectura.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    readingProgress: { upsert: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { saveProgress } from "../../src/services/progress.service.js";
import { progressSchema } from "../../src/schemas/progress.schema.js";

describe("EC-PU-003 · progress.service.saveProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): usuario autenticado guarda su progreso correctamente", async () => {
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
});
