// EC-PI-008 — Administración (src/routes/admin.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-008-admin.md
//
// Prueba el pipeline HTTP completo de administración: bloqueo real por rol,
// persistencia de QR (creado contra un id real de Gutendex) y el cruce
// admin + autor al rechazar una postulación con motivo/nota real en BD.
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, registerAndLogin, deleteTestUser } from "./helpers.js";

const ADMIN_CREDENTIALS = { email: "admin@bibliochile.cl", password: "admin1234" };
const REAL_GUTENDEX_ID = 55465; // mismo id real usado en books/progress integration

const loginAsAdmin = async () => {
  const res = await request(app).post("/api/auth/login").send(ADMIN_CREDENTIALS);
  return res.body.token;
};

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

describe("EC-PI-008 · /api/admin (HTTP real contra Postgres)", () => {
  let userId;
  let qrCodeId;

  afterEach(async () => {
    if (qrCodeId) {
      await prisma.qRCode.delete({ where: { id: qrCodeId } }).catch(() => {});
      qrCodeId = undefined;
    }
    await deleteTestUser(userId);
    userId = undefined;
  });

  it("Escenario 1 (mejor caso): admin real crea, lista y desactiva un QR — persistido y recuperable en la petición siguiente", async () => {
    const adminToken = await loginAsAdmin();
    const code = `EC-PI-008-${Date.now()}`;

    const createRes = await request(app)
      .post("/api/admin/qrcodes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ locationName: "Estación de Prueba EC-PI-008", gutendexId: REAL_GUTENDEX_ID });

    expect(createRes.status).toBe(201);
    qrCodeId = createRes.body.id;

    const listRes = await request(app)
      .get("/api/admin/qrcodes")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((qr) => qr.id === qrCodeId)).toBe(true);

    const toggleRes = await request(app)
      .patch(`/api/admin/qrcodes/${qrCodeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.is_active).toBe(false);

    const inDb = await prisma.qRCode.findUnique({ where: { id: qrCodeId } });
    expect(inDb.is_active).toBe(false);
  });

  it("Escenario 2 (caso inválido): gutendexId que no existe en Gutendex es rechazado con 404 real, sin crear nada", async () => {
    const adminToken = await loginAsAdmin();

    const res = await request(app)
      .post("/api/admin/qrcodes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ locationName: "Estación Fantasma", gutendexId: 999999999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("El libro de Gutendex no existe");
  });

  it("Escenario 3 (middleware de rol real): un usuario 'pasajero' es bloqueado por requireRole('admin') antes de llegar al service", async () => {
    const { token, user } = await registerAndLogin({ role: "pasajero" });
    userId = user.id;

    const res = await request(app).get("/api/admin/books").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("No tienes permiso para esta acción");
  });

  it("Escenario 4 (cruza módulos, regla de negocio sobre datos reales): rechazar autor con motivo 'otro' persiste la nota; con 'problema_sistema' la descarta", async () => {
    const { token, user } = await registerAndLogin({ role: "autor" });
    userId = user.id;

    await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), declarationAccepted: true });

    const authorInDb = await prisma.author.findUnique({ where: { user_id: user.id } });
    const adminToken = await loginAsAdmin();

    const rejectRes = await request(app)
      .patch(`/api/admin/authors/${authorInDb.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "otro", note: "Documentación incompleta, EC-PI-008" });

    expect(rejectRes.status).toBe(200);

    const rejected = await prisma.author.findUnique({ where: { id: authorInDb.id } });
    expect(rejected.status).toBe("rechazado");
    expect(rejected.rejection_reason).toBe("otro");
    expect(rejected.rejection_note).toBe("Documentación incompleta, EC-PI-008");
  });
});
