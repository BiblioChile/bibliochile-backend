// EC-PI-003 — Acceso por QR (src/routes/qr.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-003-qr.md
//
// Usa los QR sembrados por prisma/seed.js (BCH-001 activo, BCH-003
// inactivo) para probar la ruta real contra los datos reales persistidos,
// en vez de un prisma.qRCode.findUnique mockeado.
import { describe, it, expect } from "vitest";
import { request, app } from "./helpers.js";

describe("EC-PI-003 · GET /api/qr/:code (HTTP real contra Postgres)", () => {
  it("Escenario 1 (mejor caso): QR activo sembrado en BD redirige al libro correcto", async () => {
    const res = await request(app).get("/api/qr/BCH-001");

    expect(res.status).toBe(200);
    expect(res.body.gutendex_id).toBe(2000);
    expect(res.body.redirect_to).toBe("/books/2000");
  });

  it("Escenario 2 (caso inválido): código que no existe en la BD responde 404 con redirect_to al catálogo", async () => {
    const res = await request(app).get("/api/qr/CODIGO-QUE-NO-EXISTE");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("QR no encontrado");
    expect(res.body.redirect_to).toBe("/catalog");
  });

  it("Escenario 3 (campos vacíos / regla de negocio real): QR inactivo sembrado en BD es rechazado aunque exista", async () => {
    const res = await request(app).get("/api/qr/BCH-003");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("QR inactivo");
  });
});
