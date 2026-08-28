// EC-PI-004 — Suscripciones (src/routes/subscription.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-004-subscriptions.md
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, registerAndLogin, deleteTestUser } from "./helpers.js";

describe("EC-PI-004 · /api/subscriptions (HTTP real contra Postgres)", () => {
  let userId;

  afterEach(async () => {
    await deleteTestUser(userId);
    userId = undefined;
  });

  it("Escenario 1 (mejor caso): suscribirse persiste en Postgres y es recuperable en una petición siguiente (POST → GET)", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const postRes = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 1 });

    expect(postRes.status).toBe(201);

    // La petición siguiente (GET, request HTTP nueva) debe ver lo que
    // acaba de persistir el POST — esto es lo que un test unitario con
    // Prisma mockeado no puede probar.
    const getRes = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({ active: true, plan_name: "mensual", max_rentals: 5, rentals_used: 0 });

    const inDb = await prisma.subscription.findFirst({ where: { user_id: user.id } });
    expect(inDb).not.toBeNull();
    expect(inDb.status).toBe("activa");
  });

  it("Escenario 2 (caso inválido): planId inexistente es rechazado con 404 real (verificado contra la BD, no un mock)", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Plan no encontrado");
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza la suscripción por HTTP antes del service", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const res = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field)).toContain("planId");
  });

  it("Escenario 4 (regla de negocio real de doble suscripción): la segunda suscripción sobre datos ya persistidos es rechazada", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const first = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 1 });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 2 });

    expect(second.status).toBe(409);
    expect(second.body.message).toBe("Ya tienes una suscripción activa");

    // Confirma en la BD real que sigue existiendo solo una.
    const count = await prisma.subscription.count({ where: { user_id: user.id } });
    expect(count).toBe(1);
  });
});

describe("EC-PI-004b · PATCH /api/subscriptions (cambiar de plan, HTTP real contra Postgres)", () => {
  let userId;

  afterEach(async () => {
    await deleteTestUser(userId);
    userId = undefined;
  });

  it("Escenario 1 (mejor caso): con una suscripción mensual activa, cambiar a anual cancela la anterior y crea la nueva (200)", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const first = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 1 });
    expect(first.status).toBe(201);

    const changeRes = await request(app)
      .patch("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 2 });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.plan_id).toBe(2);
    expect(changeRes.body.status).toBe("activa");

    // Persistido de verdad: solo una fila "activa", la anterior "cancelada".
    const rows = await prisma.subscription.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.plan_id === 1).status).toBe("cancelada");
    expect(rows.find((r) => r.plan_id === 2).status).toBe("activa");

    const getRes = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.body).toMatchObject({ active: true, plan_name: "anual" });
  });

  it("Escenario 2 (sin suscripción activa): se comporta como crear una nueva (201)", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const res = await request(app)
      .patch("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("activa");

    const count = await prisma.subscription.count({ where: { user_id: user.id } });
    expect(count).toBe(1);
  });

  it("Escenario 3 (caso inválido): planId inexistente es rechazado con 404 real, sin tocar la suscripción activa", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const first = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 1 });
    expect(first.status).toBe(201);

    const res = await request(app)
      .patch("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Plan no encontrado");

    // La activa original sigue intacta: el rechazo no la tocó.
    const active = await prisma.subscription.findFirst({ where: { user_id: user.id, status: "activa" } });
    expect(active).not.toBeNull();
    expect(active.plan_id).toBe(1);
  });

  it("Escenario 4 (sin token): rechaza con 401", async () => {
    const res = await request(app).patch("/api/subscriptions").send({ planId: 1 });

    expect(res.status).toBe(401);
  });
});
