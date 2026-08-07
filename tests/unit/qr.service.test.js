// EC-PU-006 — Acceso por QR sin registro previo (src/services/qr.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-006-acceso-qr.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    qRCode: { findUnique: vi.fn() },
  },
}));

import { prisma } from "../../src/prisma/client.js";
import { getQRByCode } from "../../src/services/qr.service.js";

const mockQR = {
  code: "EST-BAQUEDANO-01",
  gutendex_id: 55465,
  location_name: "Estación Baquedano",
  is_active: true,
};

describe("EC-PU-006 · qr.service.getQRByCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): QR activo devuelve los datos del libro asociado", async () => {
    prisma.qRCode.findUnique.mockResolvedValue(mockQR);

    const result = await getQRByCode("EST-BAQUEDANO-01");

    expect(result).toEqual(mockQR);
    expect(prisma.qRCode.findUnique).toHaveBeenCalledWith({
      where: { code: "EST-BAQUEDANO-01" },
    });
  });

  it("Escenario 2 (caso inválido): código inexistente rechaza con 'QR no encontrado'", async () => {
    prisma.qRCode.findUnique.mockResolvedValue(null);

    await expect(getQRByCode("CODIGO-INEXISTENTE")).rejects.toThrow("QR no encontrado");
  });

  it("Escenario 2b (caso inválido): QR desactivado rechaza con 'QR inactivo'", async () => {
    prisma.qRCode.findUnique.mockResolvedValue({ ...mockQR, is_active: false });

    await expect(getQRByCode("EST-BAQUEDANO-01")).rejects.toThrow("QR inactivo");
  });

  it("Escenario 3 (campos vacíos): código vacío no encuentra coincidencia y rechaza", async () => {
    prisma.qRCode.findUnique.mockResolvedValue(null);

    await expect(getQRByCode("")).rejects.toThrow("QR no encontrado");
    expect(prisma.qRCode.findUnique).toHaveBeenCalledWith({ where: { code: "" } });
  });
});
