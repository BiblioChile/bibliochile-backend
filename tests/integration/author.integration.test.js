// EC-PI-007 — Perfil de autor (src/routes/author.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-007-author.md
//
// Cruza autenticación (rol en el JWT) + admin: registra un autor, confirma
// el rechazo real por HTTP mientras está pendiente, lo aprueba con el
// admin sembrado por seed.js, y confirma que la misma petición que antes
// fallaba ahora persiste un Book real — nada de esto se puede probar
// llamando los servicios por separado (author.service.test.js sí lo hace).
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, registerAndLogin, deleteTestUser } from "./helpers.js";

const ADMIN_CREDENTIALS = { email: "admin@bibliochile.cl", password: "admin1234" };

const loginAsAdmin = async () => {
  const res = await request(app).post("/api/auth/login").send(ADMIN_CREDENTIALS);
  return res.body.token;
};

// RUT válido generado para pruebas (dígito verificador correcto).
const validRut = () => {
  const body = String(10000000 + Math.floor(Math.random() * 8999999));
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const dv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return `${body}-${dv}`;
};

describe("EC-PI-007 · /api/authors (HTTP real: registro → aprobación admin → subida de obra)", () => {
  let userId;

  afterEach(async () => {
    await deleteTestUser(userId);
    userId = undefined;
  });

  it("Escenario 1 (mejor caso, cruza módulos): registro pendiente → rechazo real al subir → aprobación admin real → subida exitosa", async () => {
    const { token, user } = await registerAndLogin({ role: "autor" });
    userId = user.id;

    const registerRes = await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), bio: "Autor de prueba EC-PI-007", declarationAccepted: true });

    expect(registerRes.status).toBe(201);

    const authorInDb = await prisma.author.findUnique({ where: { user_id: user.id } });
    expect(authorInDb.status).toBe("pendiente");

    // Antes de la aprobación, subir obra es rechazado por la app completa
    // (no por llamar uploadBook() directo).
    const beforeApproval = await request(app)
      .post("/api/authors/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Obra Antes de Aprobar", contentUrl: "https://example.com/obra.html" });

    expect(beforeApproval.status).toBe(403);
    expect(beforeApproval.body.message).toBe("Tu cuenta de autor aún no ha sido aprobada");

    // El admin real (sembrado por seed.js) aprueba vía su propia ruta HTTP.
    const adminToken = await loginAsAdmin();
    const approveRes = await request(app)
      .patch(`/api/admin/authors/${authorInDb.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("aprobado");

    // La misma petición que antes fallaba ahora persiste el libro de verdad.
    const afterApproval = await request(app)
      .post("/api/authors/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Obra Después de Aprobar", contentUrl: "https://example.com/obra.html" });

    expect(afterApproval.status).toBe(201);

    const bookInDb = await prisma.book.findUnique({ where: { id: afterApproval.body.id } });
    expect(bookInDb.author_id).toBe(authorInDb.id);
    expect(bookInDb.is_free).toBe(false);

    const statsRes = await request(app)
      .get("/api/authors/me/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalBooks).toBe(1);
  });

  it("Escenario 2 (caso inválido): el schema Zod rechaza un RUT inválido por HTTP, no por isValidRut() aislado", async () => {
    const { token, user } = await registerAndLogin({ role: "autor" });
    userId = user.id;

    const res = await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: "123-4", declarationAccepted: true });

    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field)).toContain("rut");

    const authorInDb = await prisma.author.findUnique({ where: { user_id: user.id } });
    expect(authorInDb).toBeNull();
  });

  it("Escenario 3 (middleware de rol real): un usuario con rol 'pasajero' es bloqueado por requireRole antes del service", async () => {
    const { token, user } = await registerAndLogin({ role: "pasajero" });
    userId = user.id;

    const res = await request(app)
      .post("/api/authors/books")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "No debería poder", contentUrl: "https://example.com/x.html" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes permiso para esta acción");
  });

  it("Escenario 4 (flujo real de promoción): un 'pasajero' que declara autoría y es aprobado por el admin queda con role 'autor' — y necesita volver a loguearse para que el JWT lo refleje", async () => {
    // A diferencia del Escenario 1, este usuario parte como "pasajero" real
    // (no se autodeclara "autor" en el registro) — es el caso que
    // approveAuthor() estaba dejando roto: Author.status pasaba a
    // "aprobado" pero User.role nunca se actualizaba.
    const { token, user, email, password } = await registerAndLogin({ role: "pasajero" });
    userId = user.id;

    const registerRes = await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), bio: "Autor de prueba EC-PI-007 (escenario 4)", declarationAccepted: true });

    expect(registerRes.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { id: user.id } })).role).toBe("pasajero");

    const authorInDb = await prisma.author.findUnique({ where: { user_id: user.id } });

    // Con el token viejo (role "pasajero" todavía), una ruta de autor debe
    // seguir bloqueada por requireRole, sin llegar siquiera al service.
    const beforeApproval = await request(app)
      .get("/api/authors/me/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(beforeApproval.status).toBe(403);
    expect(beforeApproval.body.message).toBe("No tienes permiso para esta acción");

    const adminToken = await loginAsAdmin();
    const approveRes = await request(app)
      .patch(`/api/admin/authors/${authorInDb.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);

    // El fix: tras la aprobación, User.role ya es "autor" en la base.
    expect((await prisma.user.findUnique({ where: { id: user.id } })).role).toBe("autor");

    // Pero el JWT viejo sigue firmado con role "pasajero" — un token no se
    // actualiza solo. Con el token de ANTES de la aprobación, sigue bloqueado.
    const withStaleToken = await request(app)
      .get("/api/authors/me/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(withStaleToken.status).toBe(403);

    // Recién con un login nuevo (JWT fresco, que sí lleva role "autor")
    // la misma ruta deja de dar 403.
    const relogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    const freshToken = relogin.body.token;

    const afterApproval = await request(app)
      .get("/api/authors/me/stats")
      .set("Authorization", `Bearer ${freshToken}`);
    expect(afterApproval.status).toBe(200);
    expect(afterApproval.body.totalBooks).toBe(0);
  });
});

describe("EC-PI-007b · GET /api/authors/me (HTTP real, sin requireRole — funciona antes de la aprobación)", () => {
  let userId;

  afterEach(async () => {
    await deleteTestUser(userId);
    userId = undefined;
  });

  it("Escenario 1 (mejor caso): pasajero sin postulación — hasApplication: false, no 403 ni 404", async () => {
    const { token, user } = await registerAndLogin({ role: "pasajero" });
    userId = user.id;

    const res = await request(app).get("/api/authors/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasApplication: false });
  });

  it("Escenario 2 (caso pendiente/rechazado, con el token viejo — no requiere rol 'autor'): expone status y motivo de rechazo real", async () => {
    const { token, user } = await registerAndLogin({ role: "pasajero" });
    userId = user.id;

    await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), declarationAccepted: true });

    // Pendiente: con el mismo token de pasajero (sin re-login), /me/stats
    // daría 403, pero /me debe funcionar igual.
    const pendingRes = await request(app).get("/api/authors/me").set("Authorization", `Bearer ${token}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body).toMatchObject({ hasApplication: true, status: "pendiente" });

    const authorInDb = await prisma.author.findUnique({ where: { user_id: user.id } });
    const adminToken = await loginAsAdmin();
    await request(app)
      .patch(`/api/admin/authors/${authorInDb.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "otro", note: "Datos incompletos EC-PI-007b" });

    const rejectedRes = await request(app).get("/api/authors/me").set("Authorization", `Bearer ${token}`);
    expect(rejectedRes.status).toBe(200);
    expect(rejectedRes.body).toMatchObject({
      hasApplication: true,
      status: "rechazado",
      rejectionReason: "otro",
      rejectionNote: "Datos incompletos EC-PI-007b",
    });
  });

  it("Escenario 3 (campos vacíos/middleware transversal): sin token, 401 — la ruta sigue requiriendo sesión aunque no requiera rol", async () => {
    const res = await request(app).get("/api/authors/me");

    expect(res.status).toBe(401);
  });
});
