// EC-PU-002 — Suscribirse a un plan (src/services/subscription.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-002-suscripcion.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), create: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { createSubscription } from "../../src/services/subscription.service.js";
import { subscriptionSchema } from "../../src/schemas/subscription.schema.js";

const mockPlan = { id: 1, name: "mensual", duration_days: 30, price: 3990, max_rentals: 5 };

describe("EC-PU-002 · subscription.service.createSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): sin suscripción activa y plan válido, crea la suscripción", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
    prisma.subscription.create.mockResolvedValue({
      id: 10,
      user_id: 1,
      plan_id: mockPlan.id,
      status: "activa",
    });

    const result = await createSubscription(1, mockPlan.id);

    expect(result.status).toBe("activa");
    expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
  });

  it("Escenario 2 (caso inválido): usuario con suscripción activa no puede suscribirse de nuevo", async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 5, status: "activa" });

    await expect(createSubscription(1, mockPlan.id)).rejects.toThrow(
      "Ya tienes una suscripción activa"
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("Escenario 2b (caso inválido): plan inexistente rechaza la suscripción", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(createSubscription(1, 999)).rejects.toThrow("Plan no encontrado");
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza planId ausente", () => {
    const result = subscriptionSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path[0]).toBe("planId");
  });
});
