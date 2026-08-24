// EC-PU-010 — Administración: catálogo gestionable, QR y decisiones de autor (src/services/admin.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-010-administracion.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    book: { findMany: vi.fn() },
    qRCode: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    author: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../../src/services/book.service.js", () => ({
  getBookById: vi.fn(),
}));

import { prisma } from "../../src/prisma/client.js";
import { getBookById } from "../../src/services/book.service.js";
import {
  listManagedBooks,
  createQRCode,
  listQRCodes,
  toggleQRCode,
  listPendingAuthors,
  approveAuthor,
  rejectAuthor,
} from "../../src/services/admin.service.js";

describe("EC-PU-010 · admin.service.listManagedBooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): devuelve los Book con author_id o gutendex_id, no null", async () => {
    const mockBooks = [
      { id: 1, title: "Mi novela", author_id: 1, gutendex_id: null },
      { id: 2, title: "Don Quijote", author_id: null, gutendex_id: 2000 },
    ];
    prisma.book.findMany.mockResolvedValue(mockBooks);

    const result = await listManagedBooks();

    expect(result).toEqual(mockBooks);
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ author_id: { not: null } }, { gutendex_id: { not: null } }] },
      })
    );
  });

  it("Escenario 2 (caso inválido): error de Prisma se propaga sin ser capturado", async () => {
    prisma.book.findMany.mockRejectedValue(new Error("Error de conexión"));

    await expect(listManagedBooks()).rejects.toThrow("Error de conexión");
  });

  it("Escenario 3 (campos vacíos): sin libros gestionables, devuelve arreglo vacío", async () => {
    prisma.book.findMany.mockResolvedValue([]);

    const result = await listManagedBooks();

    expect(result).toEqual([]);
  });
});

describe("EC-PU-010 · admin.service.createQRCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBookById.mockResolvedValue({ id: 55465, title: "Libro válido" });
  });

  it("Escenario 1 (mejor caso): valida el gutendexId contra Gutendex, genera un code correlativo y crea el QR", async () => {
    prisma.qRCode.count.mockResolvedValue(3);
    const mockQR = { id: 4, code: "BCH-004", location_name: "Estación Los Héroes", gutendex_id: 55465, created_by: 1 };
    prisma.qRCode.create.mockResolvedValue(mockQR);

    const result = await createQRCode("Estación Los Héroes", 55465, 1);

    expect(result).toEqual(mockQR);
    expect(getBookById).toHaveBeenCalledWith(55465);
    expect(prisma.qRCode.create).toHaveBeenCalledWith({
      data: { code: "BCH-004", location_name: "Estación Los Héroes", gutendex_id: 55465, created_by: 1 },
    });
  });

  it("Escenario 2 (caso inválido): gutendexId inexistente en Gutendex rechaza sin crear el QR", async () => {
    getBookById.mockRejectedValue(new Error("Libro no encontrado"));

    await expect(createQRCode("Estación X", 999999, 1)).rejects.toThrow("El libro de Gutendex no existe");
    expect(prisma.qRCode.create).not.toHaveBeenCalled();
  });

  it("Escenario 2b (caso inválido): error de Prisma al crear se propaga sin ser capturado", async () => {
    prisma.qRCode.count.mockResolvedValue(0);
    prisma.qRCode.create.mockRejectedValue(new Error("Error de conexión"));

    await expect(createQRCode("Estación X", 1, 1)).rejects.toThrow("Error de conexión");
  });

  it("Escenario 3 (campos vacíos): primer QR del sistema genera BCH-001", async () => {
    prisma.qRCode.count.mockResolvedValue(0);
    prisma.qRCode.create.mockResolvedValue({ id: 1, code: "BCH-001" });

    await createQRCode("Estación Y", 2, 1);

    expect(prisma.qRCode.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "BCH-001" }) })
    );
  });
});

describe("EC-PU-010 · admin.service.listQRCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): devuelve los QR ordenados por fecha de creación descendente", async () => {
    const mockQRs = [{ id: 2, code: "BCH-002" }, { id: 1, code: "BCH-001" }];
    prisma.qRCode.findMany.mockResolvedValue(mockQRs);

    const result = await listQRCodes();

    expect(result).toEqual(mockQRs);
    expect(prisma.qRCode.findMany).toHaveBeenCalledWith({ orderBy: { created_at: "desc" } });
  });

  it("Escenario 2 (caso inválido): error de Prisma se propaga sin ser capturado", async () => {
    prisma.qRCode.findMany.mockRejectedValue(new Error("Error de conexión"));

    await expect(listQRCodes()).rejects.toThrow("Error de conexión");
  });

  it("Escenario 3 (campos vacíos): sin QR creados, devuelve arreglo vacío", async () => {
    prisma.qRCode.findMany.mockResolvedValue([]);

    const result = await listQRCodes();

    expect(result).toEqual([]);
  });
});

describe("EC-PU-010 · admin.service.toggleQRCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): QR activo se desactiva", async () => {
    prisma.qRCode.findUnique.mockResolvedValue({ id: 1, is_active: true });
    prisma.qRCode.update.mockResolvedValue({ id: 1, is_active: false });

    const result = await toggleQRCode(1);

    expect(result).toEqual({ id: 1, is_active: false });
    expect(prisma.qRCode.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { is_active: false } });
  });

  it("Escenario 2 (caso inválido): QR inexistente rechaza con 'QR no encontrado'", async () => {
    prisma.qRCode.findUnique.mockResolvedValue(null);

    await expect(toggleQRCode(999)).rejects.toThrow("QR no encontrado");
    expect(prisma.qRCode.update).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): QR inactivo se reactiva", async () => {
    prisma.qRCode.findUnique.mockResolvedValue({ id: 2, is_active: false });
    prisma.qRCode.update.mockResolvedValue({ id: 2, is_active: true });

    const result = await toggleQRCode(2);

    expect(result).toEqual({ id: 2, is_active: true });
  });
});

describe("EC-PU-010 · admin.service.listPendingAuthors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): devuelve autores pendientes con datos completos", async () => {
    const mockAuthors = [
      { id: 1, rut: "12345678-5", bio: "Escritor", status: "pendiente", user: { name: "Ana", email: "ana@mail.com" } },
    ];
    prisma.author.findMany.mockResolvedValue(mockAuthors);

    const result = await listPendingAuthors();

    expect(result).toEqual(mockAuthors);
    expect(prisma.author.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pendiente" } })
    );
  });

  it("Escenario 2 (caso inválido): error de Prisma se propaga sin ser capturado", async () => {
    prisma.author.findMany.mockRejectedValue(new Error("Error de conexión"));

    await expect(listPendingAuthors()).rejects.toThrow("Error de conexión");
  });

  it("Escenario 3 (campos vacíos): sin autores pendientes, devuelve arreglo vacío", async () => {
    prisma.author.findMany.mockResolvedValue([]);

    const result = await listPendingAuthors();

    expect(result).toEqual([]);
  });
});

describe("EC-PU-010 · admin.service.approveAuthor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): aprueba un autor pendiente y limpia rejection_reason/note", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "pendiente" });
    prisma.author.update.mockResolvedValue({ id: 1, status: "aprobado" });

    const result = await approveAuthor(1);

    expect(result).toEqual({ id: 1, status: "aprobado" });
    expect(prisma.author.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "aprobado", rejection_reason: null, rejection_note: null },
    });
  });

  it("Escenario 2 (caso inválido): autor inexistente rechaza con 'Autor no encontrado'", async () => {
    prisma.author.findUnique.mockResolvedValue(null);

    await expect(approveAuthor(999)).rejects.toThrow("Autor no encontrado");
    expect(prisma.author.update).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): re-aprueba un autor previamente rechazado", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 2, status: "rechazado", rejection_reason: "otro" });
    prisma.author.update.mockResolvedValue({ id: 2, status: "aprobado" });

    const result = await approveAuthor(2);

    expect(result.status).toBe("aprobado");
  });
});

describe("EC-PU-010 · admin.service.rejectAuthor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): rechaza con reason 'problema_sistema', sin nota", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 1, status: "pendiente" });
    prisma.author.update.mockResolvedValue({ id: 1, status: "rechazado", rejection_reason: "problema_sistema" });

    const result = await rejectAuthor(1, "problema_sistema", undefined);

    expect(result.status).toBe("rechazado");
    expect(prisma.author.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "rechazado", rejection_reason: "problema_sistema", rejection_note: null },
    });
  });

  it("Escenario 2 (caso inválido): autor inexistente rechaza con 'Autor no encontrado'", async () => {
    prisma.author.findUnique.mockResolvedValue(null);

    await expect(rejectAuthor(999, "otro", "motivo")).rejects.toThrow("Autor no encontrado");
    expect(prisma.author.update).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos): reason 'otro' sin note guarda rejection_note null", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 3, status: "pendiente" });
    prisma.author.update.mockResolvedValue({ id: 3, status: "rechazado", rejection_reason: "otro", rejection_note: null });

    await rejectAuthor(3, "otro", undefined);

    expect(prisma.author.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { status: "rechazado", rejection_reason: "otro", rejection_note: null },
    });
  });

  it("Escenario 3b: reason 'otro' con note la guarda tal cual", async () => {
    prisma.author.findUnique.mockResolvedValue({ id: 4, status: "pendiente" });
    prisma.author.update.mockResolvedValue({ id: 4, status: "rechazado" });

    await rejectAuthor(4, "otro", "Documentación incompleta");

    expect(prisma.author.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { status: "rechazado", rejection_reason: "otro", rejection_note: "Documentación incompleta" },
    });
  });
});
