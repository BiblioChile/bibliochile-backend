// EC-PU-005 — Explorar catálogo de libros (src/services/book.service.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PU-005-catalogo-libros.md
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("../../src/prisma/client.js", () => ({
  prisma: {
    book: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

import fetch from "node-fetch";
import { prisma } from "../../src/prisma/client.js";
import { getBooks, getBookById, getPaidBooks } from "../../src/services/book.service.js";

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

  it("Escenario 2 (caso inválido): id inexistente ni local ni en Gutendex rechaza con 'Libro no encontrado'", async () => {
    prisma.book.findUnique.mockResolvedValue(null);
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

// EC-PU-005c — fix de colisión de id: getBookById debe mirar primero el
// Book local antes de caer a Gutendex, o un id autoincrement de Postgres
// puede colisionar con un id real de Gutendex y devolver un libro
// completamente distinto (grave para libros de pago: se verían como
// is_free: true, saltándose el control de acceso de Rental). Ver
// env/Prompt_fix_getbookbyid_coleccion.md y
// docs/pruebas-unitarias/EC-PU-005-catalogo-libros.md.
describe("EC-PU-005c · book.service.getBookById — prioridad Book local sobre Gutendex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): id de un libro de pago local — devuelve el libro local y NO consulta Gutendex", async () => {
    prisma.book.findUnique.mockResolvedValue({
      id: 51,
      title: "Obra de Prueba QA",
      description: "Libro de pago para pruebas de arriendo",
      cover_url: null,
      content_url: "https://example.com/obra-prueba.pdf",
      is_free: false,
      author: { user: { name: "Autora de Prueba" } },
    });

    const result = await getBookById(51);

    expect(result).toEqual({
      id: 51,
      title: "Obra de Prueba QA",
      author: "Autora de Prueba",
      description: "Libro de pago para pruebas de arriendo",
      cover_url: null,
      content_url: "https://example.com/obra-prueba.pdf",
      is_free: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Escenario 2 (caso borde): id interno de un libro GRATUITO ya sincronizado localmente — también se sirve desde Postgres, no rompe is_free", async () => {
    prisma.book.findUnique.mockResolvedValue({
      id: 7,
      title: "Martín Rivas",
      description: null,
      cover_url: null,
      content_url: "https://gutendex.com/books/1000.html",
      is_free: true,
      author: null,
    });

    const result = await getBookById(7);

    expect(result.is_free).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Escenario 3 (campos vacíos/no numérico): id no numérico no se busca en Postgres (findUnique con NaN rompería Prisma) y cae directo a Gutendex", async () => {
    fetch.mockResolvedValue({ ok: false });

    await expect(getBookById("no-numerico")).rejects.toThrow("Libro no encontrado");
    expect(prisma.book.findUnique).not.toHaveBeenCalled();
  });
});

// EC-PU-005b — catálogo de pago local (getPaidBooks), agregado junto con
// GET /api/books/paid — ver docs/pruebas-unitarias/EC-PU-005-catalogo-libros.md
describe("EC-PU-005b · book.service.getPaidBooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Escenario 1 (mejor caso): devuelve los Book locales con is_free false, mapeados con el nombre del autor", async () => {
    prisma.book.findMany.mockResolvedValue([
      {
        id: 42,
        title: "Obra de autor nacional",
        description: "Descripción de la obra",
        cover_url: "https://cdn.example.com/cover.jpg",
        content_url: "https://cdn.example.com/obra.html",
        author: { user: { name: "Autora Nacional" } },
      },
    ]);

    const result = await getPaidBooks();

    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_free: false } })
    );
    expect(result).toEqual({
      count: 1,
      results: [
        {
          id: 42,
          title: "Obra de autor nacional",
          author: "Autora Nacional",
          description: "Descripción de la obra",
          cover_url: "https://cdn.example.com/cover.jpg",
          content_url: "https://cdn.example.com/obra.html",
          is_free: false,
        },
      ],
    });
  });

  it("Escenario 2 (caso inválido): libro con relación author/user faltante cae a 'Autor desconocido' en vez de fallar", async () => {
    prisma.book.findMany.mockResolvedValue([
      {
        id: 43,
        title: "Obra huérfana",
        description: null,
        cover_url: null,
        content_url: "https://cdn.example.com/obra2.html",
        author: null,
      },
    ]);

    const result = await getPaidBooks();

    expect(result.results[0].author).toBe("Autor desconocido");
  });

  it("Escenario 3 (campos vacíos): sin libros de pago devuelve count 0 y results []", async () => {
    prisma.book.findMany.mockResolvedValue([]);

    const result = await getPaidBooks();

    expect(result).toEqual({ count: 0, results: [] });
  });
});
