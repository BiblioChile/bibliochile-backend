// EC-PU-002 — Suscribirse a un plan (src/services/subscription.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-002-suscripcion.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { createSubscription, changeSubscriptionPlan } from "../../src/services/subscription.service.js";
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

// EC-PU-002c — Cambiar de plan (src/services/subscription.service.js, changeSubscriptionPlan)
describe("EC-PU-002c · subscription.service.changeSubscriptionPlan", () => {
  const mockAnual = { id: 2, name: "anual", duration_days: 365, price: 39990, max_rentals: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): con suscripción activa, la cancela y crea la nueva con el plan pedido", async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(mockAnual);
    prisma.subscription.findFirst.mockResolvedValue({ id: 5, plan_id: 1, status: "activa" });
    prisma.subscription.update.mockResolvedValue({ id: 5, status: "cancelada" });
    prisma.subscription.create.mockResolvedValue({
      id: 11,
      user_id: 1,
      plan_id: mockAnual.id,
      status: "activa",
    });

    const result = await changeSubscriptionPlan(1, mockAnual.id);

    expect(result.changed).toBe(true);
    expect(result.subscription.plan_id).toBe(mockAnual.id);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "cancelada" },
    });
    expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
  });

  it("Escenario 2 (sin suscripción activa): se comporta como crear una nueva, sin llamar a update", async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(mockAnual);
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.subscription.create.mockResolvedValue({
      id: 12,
      user_id: 1,
      plan_id: mockAnual.id,
      status: "activa",
    });

    const result = await changeSubscriptionPlan(1, mockAnual.id);

    expect(result.changed).toBe(false);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.create).toHaveBeenCalledTimes(1);
  });

  it("Escenario 3 (caso inválido): plan inexistente rechaza el cambio sin tocar la suscripción activa", async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(changeSubscriptionPlan(1, 999)).rejects.toThrow("Plan no encontrado");
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});
