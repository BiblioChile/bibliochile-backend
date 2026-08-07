// EC-PU-007 — Middlewares transversales: autenticación, validación y roles
// (src/middlewares/auth.middleware.js, validation.middleware.js, role.middleware.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-007-middlewares-transversales.md
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("jsonwebtoken", () => ({
  default: { verify: vi.fn() },
}));

import jwt from "jsonwebtoken";
import { verifyToken, optionalAuth } from "../../src/middlewares/auth.middleware.js";
import { validate } from "../../src/middlewares/validation.middleware.js";
import { requireRole } from "../../src/middlewares/role.middleware.js";

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("EC-PU-007 · verifyToken (autenticación obligatoria)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): token válido decodifica el usuario y continúa", () => {
    const req = { headers: { authorization: "Bearer token-valido" } };
    const res = mockRes();
    const next = vi.fn();
    jwt.verify.mockReturnValue({ id: 1, role: "pasajero" });

    verifyToken(req, res, next);

    expect(req.user).toEqual({ id: 1, role: "pasajero" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("Escenario 2 (caso inválido): token inválido rechaza con 401", () => {
    const req = { headers: { authorization: "Bearer token-invalido" } };
    const res = mockRes();
    const next = vi.fn();
    jwt.verify.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token inválido o expirado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): header de autorización ausente rechaza con 401", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token no proporcionado" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("EC-PU-007 · optionalAuth (autenticación opcional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): token válido adjunta el usuario y continúa", () => {
    const req = { headers: { authorization: "Bearer token-valido" } };
    const res = mockRes();
    const next = vi.fn();
    jwt.verify.mockReturnValue({ id: 1, role: "pasajero" });

    optionalAuth(req, res, next);

    expect(req.user).toEqual({ id: 1, role: "pasajero" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("Escenario 2 (caso inválido): token inválido continúa como anónimo, sin rechazar", () => {
    const req = { headers: { authorization: "Bearer token-invalido" } };
    const res = mockRes();
    const next = vi.fn();
    jwt.verify.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): sin header de autorización continúa como anónimo", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("EC-PU-007 · validate (validación de body con Zod)", () => {
  const schema = z.object({
    email: z.string().min(1, "El email es obligatorio"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  });

  it("Escenario 1 (mejor caso): body válido reemplaza req.body con los datos parseados y continúa", () => {
    const req = { body: { email: "juan.perez@email.cl", password: "password123" } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ email: "juan.perez@email.cl", password: "password123" });
  });

  it("Escenario 2 (caso inválido): tipo de dato incorrecto rechaza con 422", () => {
    const req = { body: { email: 12345, password: "password123" } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): body vacío rechaza con 422 y detalla los campos faltantes", () => {
    const req = { body: {} };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0][0];
    const fields = payload.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
    expect(next).not.toHaveBeenCalled();
  });
});

describe("EC-PU-007 · requireRole (control de acceso por rol)", () => {
  it("Escenario 1 (mejor caso): usuario con rol permitido continúa", () => {
    const req = { user: { id: 1, role: "admin" } };
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("Escenario 2 (caso inválido): usuario con rol no permitido rechaza con 403", () => {
    const req = { user: { id: 2, role: "pasajero" } };
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): sin usuario autenticado rechaza con 401", () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
