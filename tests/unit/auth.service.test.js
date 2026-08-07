// EC-PU-001 — Login de usuario (src/services/auth.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-001-login.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));
vi.mock("jsonwebtoken", () => ({
  default: { sign: vi.fn() },
}));

import { prisma } from "../../src/prisma/client.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { login } from "../../src/services/auth.service.js";
import authSchemas from "../../src/schemas/auth.schema.js";

const { loginSchema } = authSchemas;

const mockUser = {
  id: 1,
  name: "Juan Carlos",
  email: "juan.perez@email.cl",
  password: "hashed-password",
  role: "pasajero",
};

describe("EC-PU-001 · auth.service.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): credenciales válidas devuelven token y datos del usuario", async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("token-valido");

    const result = await login({ email: mockUser.email, password: "password123" });

    expect(result.token).toBe("token-valido");
    expect(result.user).toEqual({
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it("Escenario 2 (caso inválido): contraseña incorrecta rechaza el login", async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      login({ email: mockUser.email, password: "clave-incorrecta" })
    ).rejects.toThrow("Credenciales inválidas");
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("Escenario 2b (caso inválido): usuario inexistente rechaza el login", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      login({ email: "no-existe@email.cl", password: "cualquiera" })
    ).rejects.toThrow("Credenciales inválidas");
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza email y password vacíos", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });

    expect(result.success).toBe(false);
    const fields = result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });
});
