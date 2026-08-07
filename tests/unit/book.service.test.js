// EC-PU-005 — Explorar catálogo de libros (src/services/book.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-005-catalogo-libros.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

import fetch from "node-fetch";
import { getBooks, getBookById } from "../../src/services/book.service.js";

const mockGutendexBook = {
  id: 55465,
  title: "Martín Rivas",
  authors: [{ name: "Alberto Blest Gana" }],
  summaries: ["Novela costumbrista chilena."],
  formats: {
    "image/jpeg": "https://gutendex.com/covers/55465.jpg",
    "text/html": "https://gutendex.com/books/55465.html",
  },
};

describe("EC-PU-005 · book.service.getBooks / getBookById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): búsqueda con filtro devuelve libros mapeados", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        next: null,
        previous: null,
        results: [mockGutendexBook],
      }),
    });

    const result = await getBooks({ search: "martin rivas", page: 1 });

    expect(result.count).toBe(1);
    expect(result.results[0]).toEqual({
      id: 55465,
      title: "Martín Rivas",
      author: "Alberto Blest Gana",
      description: "Novela costumbrista chilena.",
      cover_url: "https://gutendex.com/covers/55465.jpg",
      content_url: "https://gutendex.com/books/55465.html",
      is_free: true,
    });
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain("search=martin+rivas");
  });

  it("Escenario 2 (caso inválido): id inexistente rechaza con 'Libro no encontrado'", async () => {
    fetch.mockResolvedValue({ ok: false });

    await expect(getBookById(999999)).rejects.toThrow("Libro no encontrado");
  });

  it("Escenario 2b (caso inválido): falla de conexión con Gutendex rechaza la búsqueda", async () => {
    fetch.mockResolvedValue({ ok: false });

    await expect(getBooks({ search: "cualquiera" })).rejects.toThrow(
      "Error al conectar con Gutendex"
    );
  });

  it("Escenario 3 (campos vacíos): sin filtros usa solo los parámetros por defecto", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, next: null, previous: null, results: [] }),
    });

    await getBooks({});

    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toContain("languages=es");
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).not.toContain("search=");
    expect(calledUrl).not.toContain("topic=");
  });
});
