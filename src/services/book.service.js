import fetch from "node-fetch";

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

    const response = await fetch(`${GUTENDEX_URL}?${params}`);

    if (!response.ok) {
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

const getBookById = async (id) => {
    const response = await fetch(`${GUTENDEX_URL}/${id}`);

    if (!response.ok) {
        throw new Error("Libro no encontrado");
    }

    const book = await response.json();
    return mapBook(book);
};

export { getBooks, getBookById };