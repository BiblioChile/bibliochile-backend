// EC-PI-005 — Arriendos (src/routes/rental.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-005-rentals.md
//
// Cruza suscripción + libro + arriendo: el escenario "mejor caso" solo
// tiene sentido con las tres tablas reales persistidas y relacionadas
// entre sí, algo que rental.service.test.js prueba con mocks aislados.
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, registerAndLogin, deleteTestUser, deleteBook } from "./helpers.js";

// El plan "mensual" sembrado (id 1) tiene max_rentals: 5.
const createPaidBook = (title) =>
  prisma.book.create({
    data: { title, is_free: false, content_url: "https://example.com/libro-de-pago.html" },
  });

describe("EC-PI-005 · /api/rentals (HTTP real contra Postgres)", () => {
  let userId;
  let bookId;

  afterEach(async () => {
    await deleteTestUser(userId);
    await deleteBook(bookId);
    userId = undefined;
    bookId = undefined;
  });

  it("Escenario 1 (mejor caso): con suscripción activa persistida, arrienda un libro real y aparece en GET /me", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;
    await request(app).post("/api/subscriptions").set("Authorization", `Bearer ${token}`).send({ planId: 1 });

    const book = await createPaidBook("Libro de Pago EC-PI-005");
    bookId = book.id;

    const rentRes = await request(app)
      .post("/api/rentals")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookId });

    expect(rentRes.status).toBe(201);

    const listRes = await request(app).get("/api/rentals/me").set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].bookId).toBe(bookId);
    expect(listRes.body[0].book.title).toBe("Libro de Pago EC-PI-005");
  });

  it("Escenario 2 (caso inválido): sin suscripción activa en la BD, el arriendo es rechazado con 403", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const book = await createPaidBook("Libro de Pago Sin Suscripción");
    bookId = book.id;

    const res = await request(app)
      .post("/api/rentals")
      .set("Authorization", `Bearer ${token}`)
      .send({ bookId });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes una suscripción activa");

    const count = await prisma.rental.count({ where: { user_id: user.id } });
    expect(count).toBe(0);
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza bookId ausente/no numérico por HTTP", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;

    const res = await request(app)
      .post("/api/rentals")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field)).toContain("bookId");
  });

  it("Escenario 4 (regla de negocio sobre datos persistidos): re-arrendar el mismo libro reutiliza la fila existente, sin duplicar", async () => {
    const { token, user } = await registerAndLogin();
    userId = user.id;
    await request(app).post("/api/subscriptions").set("Authorization", `Bearer ${token}`).send({ planId: 1 });

    const book = await createPaidBook("Libro Re-arrendado");
    bookId = book.id;

    await request(app).post("/api/rentals").set("Authorization", `Bearer ${token}`).send({ bookId });
    await request(app).post("/api/rentals").set("Authorization", `Bearer ${token}`).send({ bookId });

    const count = await prisma.rental.count({ where: { user_id: user.id, book_id: bookId } });
    expect(count).toBe(1);
  });
});
