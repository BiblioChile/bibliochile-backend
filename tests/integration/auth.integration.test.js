// EC-PI-001 — Registro y login (src/routes/auth.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-001-auth.md
//
// A diferencia de auth.service.test.js (unitario, Prisma mockeado), acá se
// golpea la ruta HTTP real contra el Postgres local de Docker: valida el
// pipeline completo request → validate(Zod) → controller → service → BD.
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, uniqueEmail, deleteTestUser } from "./helpers.js";

describe("EC-PI-001 · POST /api/auth/register + /api/auth/login (HTTP real)", () => {
  let createdUserId;

  afterEach(async () => {
    await deleteTestUser(createdUserId);
    createdUserId = undefined;
  });

  it("Escenario 1 (mejor caso): registrar, loguear y usar el token en una ruta protegida real", async () => {
    const email = uniqueEmail("auth");

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Persona de Prueba", email, password: "password123" });

    expect(registerRes.status).toBe(201);
    createdUserId = registerRes.body.id;

    // Persistencia real: el usuario existe en Postgres, no en un mock.
    const inDb = await prisma.user.findUnique({ where: { email } });
    expect(inDb).not.toBeNull();
    expect(inDb.role).toBe("pasajero");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123" });

    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe("string");

    // El JWT emitido por /login funciona de verdad contra verifyToken en
    // otra ruta protegida (subscriptions/me) — esto solo se puede probar
    // con la app completa corriendo, no llamando funciones aisladas.
    const protectedRes = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(protectedRes.status).toBe(200);
  });

  it("Escenario 2 (caso inválido): el schema Zod rechaza el registro por HTTP antes de llegar al service", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "no-es-un-email", password: "123" });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Error de validación");
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "password"]));

    // No debe haber llegado a crear nada en la BD.
    const inDb = await prisma.user.findUnique({ where: { email: "no-es-un-email" } });
    expect(inDb).toBeNull();
  });

  it("Escenario 3 (campos vacíos): body vacío en login es rechazado por el middleware de validación, no por el service", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("Escenario 4 (middleware transversal): una ruta protegida bloquea de verdad sin token, y con token corrupto", async () => {
    const withoutToken = await request(app).get("/api/subscriptions/me");
    expect(withoutToken.status).toBe(401);

    const withGarbageToken = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", "Bearer esto-no-es-un-jwt-valido");
    expect(withGarbageToken.status).toBe(401);
  });
});
