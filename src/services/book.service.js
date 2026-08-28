import fetch from "node-fetch";
import { prisma } from "../prisma/client.js";

const GUTENDEX_URL = "https://gutendex.com/books";

const mapBook = (book) => ({
    id: book.id,
    title: book.title,
    author: book.authors[0]?.name ?? "Autor desconocido",
    description: book.summaries[0] ?? null,
    cover_url: book.formats["image/jpeg"] ?? null,
    content_url: book.formats["text/html"] ?? book.formats["text/plain; charset=utf-8"] ?? null,
    is_free: true,
});

const getBooks = async ({ search, genre, page = 1 } = {}) => {
    const params = new URLSearchParams({ languages: "es", page });
    if (search) params.append("search", search);
    if (genre) params.append("topic", genre);

    let response;
    try {
        response = await fetch(`${GUTENDEX_URL}?${params}`);
    } catch (networkError) {
        // TODO(fix/gutendex-debug): logging temporal de diagnóstico — captura la causa
        // real de un fallo de red (DNS, timeout, conexión rechazada) antes de relanzar
        // el mismo mensaje genérico que ya veía el usuario. Quitar cuando se resuelva
        // el bug de producción en Render.
        console.error("[gutendex-debug] Fallo de red al conectar con Gutendex:", {
            message: networkError.message,
            cause: networkError.cause,
        });
        throw new Error("Error al conectar con Gutendex");
    }

    if (!response.ok) {
        // TODO(fix/gutendex-debug): logging temporal de diagnóstico — captura el status
        // code y el body real que devolvió Gutendex antes de relanzar el mismo mensaje
        // genérico. Quitar cuando se resuelva el bug de producción en Render.
        const body = typeof response.text === "function" ? await response.text().catch(() => null) : null;
        console.error("[gutendex-debug] Gutendex respondió con error:", {
            status: response.status,
            statusText: response.statusText,
            body,
        });
        throw new Error("Error al conectar con Gutendex");
    }

    const data = await response.json();

    return {
        count: data.count,
        next: data.next,
        previous: data.previous,
        results: data.results.map(mapBook),
    };
};

// Mapea un Book local (Postgres) al mismo shape que mapBook() usa para
// Gutendex, para que BookDetail.jsx y el resto del frontend no tengan que
// distinguir el origen del libro.
const mapLocalBook = (book) => ({
    id: book.id,
    title: book.title,
    author: book.author?.user?.name ?? "Autor desconocido",
    description: book.description,
    cover_url: book.cover_url,
    content_url: book.content_url,
    is_free: book.is_free,
});

const getBookById = async (id) => {
    // Busca primero en el Book local — cubre tanto los libros de pago
    // (nunca existen en Gutendex) como los gratuitos ya sincronizados antes
    // por ensureBookExists() (progress.service.js), con su id interno.
    // Sin este chequeo, un id autoincrement de Postgres puede colisionar con
    // un id real de Gutendex y devolver un libro completamente distinto —
    // grave en el caso de un libro de pago, que así se ve como is_free: true
    // y se salta el control de acceso de Rental.
    const numericId = Number(id);
    const localBook = Number.isInteger(numericId)
        ? await prisma.book.findUnique({
            where: { id: numericId },
            include: { author: { include: { user: true } } },
        })
        : null;
    if (localBook) {
        return mapLocalBook(localBook);
    }

    const response = await fetch(`${GUTENDEX_URL}/${id}`);

    if (!response.ok) {
        throw new Error("Libro no encontrado");
    }

    const book = await response.json();
    return mapBook(book);
};

// Catálogo de pago (local, Postgres) — a diferencia de getBooks/getBookById,
// que sirven el catálogo gratuito en vivo desde Gutendex, esta función lista
// las obras subidas por autores nacionales (Book.is_free === false), que de
// otra forma nunca aparecen en ningún listado: GET /books nunca las toca
// porque book.service.js no consulta Prisma para el catálogo de Gutendex.
const getPaidBooks = async () => {
    const books = await prisma.book.findMany({
        where: { is_free: false },
        include: { author: { include: { user: true } } },
        orderBy: { created_at: "desc" },
    });

    const results = books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author?.user?.name ?? "Autor desconocido",
        description: book.description,
        cover_url: book.cover_url,
        content_url: book.content_url,
        is_free: false,
    }));

    return { count: results.length, results };
};

export { getBooks, getBookById, getPaidBooks };