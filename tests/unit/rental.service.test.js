// EC-PU-004 — Arrendar un libro (src/services/rental.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-004-arriendo-libro.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    subscription: { findFirst: vi.fn() },
    book: { findUnique: vi.fn() },
    rental: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { createRental } from "../../src/services/rental.service.js";
import { rentalSchema } from "../../src/schemas/rental.schema.js";

const mockSubscription = {
  id: 10,
  end_date: new Date("2026-12-31"),
  plan: { max_rentals: 5 },
  _count: { rentals: 1 },
};
const mockBook = { id: 123, title: "Martín Rivas" };

describe("EC-PU-004 · rental.service.createRental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): suscripción activa y bajo el límite, crea el arriendo", async () => {
    prisma.subscription.findFirst.mockResolvedValue(mockSubscription);
    prisma.book.findUnique.mockResolvedValue(mockBook);
    prisma.rental.findFirst.mockResolvedValue(null);
    prisma.rental.create.mockResolvedValue({
      id: 1,
      user_id: 7,
      book_id: 123,
      subscription_id: 10,
      expires_at: mockSubscription.end_date,
    });

    const result = await createRental(7, 123);

    expect(result.book_id).toBe(123);
    expect(prisma.rental.create).toHaveBeenCalledTimes(1);
  });

  it("Escenario 2 (caso inválido): sin suscripción activa, rechaza el arriendo", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(createRental(7, 123)).rejects.toThrow("No tienes una suscripción activa");
    expect(prisma.rental.create).not.toHaveBeenCalled();
  });

  it("Escenario 2b (caso inválido): al alcanzar el límite del plan, rechaza el arriendo", async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      ...mockSubscription,
      _count: { rentals: 5 },
    });
    prisma.book.findUnique.mockResolvedValue(mockBook);
    prisma.rental.findFirst.mockResolvedValue(null);

    await expect(createRental(7, 123)).rejects.toThrow(
      "Has alcanzado el límite de arriendos de tu plan"
    );
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza bookId ausente", () => {
    const result = rentalSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path[0]).toBe("bookId");
  });
});
