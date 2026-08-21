import { prisma } from "../prisma/client.js";
import { getBookById } from "./book.service.js";

const ensureBookExists = async (bookId) => {
    // `bookId` puede ser el id interno de un libro de pago (autor nacional,
    // ya existente en Book vía el flujo de subida) o el id de Gutendex de un
    // libro gratuito del catálogo público (HU-04), que puede no estar
    // sincronizado todavía. Se prueban ambas interpretaciones.
    const existingById = await prisma.book.findUnique({ where: { id: bookId } });
    if (existingById) {
        return existingById;
    }

    const existingByGutendexId = await prisma.book.findUnique({ where: { gutendex_id: bookId } });
    if (existingByGutendexId) {
        return existingByGutendexId;
    }

    // No existe localmente por ninguna de las dos vías. Solo se auto-crea si
    // es un libro gratuito del catálogo público de Gutendex. Los libros de
    // pago (autores nacionales) deben existir en Book de antemano vía el
    // flujo de arriendo — si no existen ahí, NO se crean automáticamente acá.
    let gutendexBook;
    try {
        gutendexBook = await getBookById(bookId);
    } catch {
        throw new Error("Libro no encontrado");
    }

    try {
        return await prisma.book.upsert({
            where: { gutendex_id: bookId },
            update: {},
            create: {
                gutendex_id: bookId,
                title: gutendexBook.title,
                is_free: true,
                content_url: gutendexBook.content_url ?? `https://gutendex.com/books/${bookId}`,
                cover_url: gutendexBook.cover_url,
                description: gutendexBook.description,
            },
        });
    } catch {
        throw new Error("No se pudo sincronizar el libro para guardar el progreso");
    }
};

const saveProgress = async ({userId, anonymousUuid, bookId, progressPercentage, lastPosition}) => {
    if (!userId && !anonymousUuid) {
        throw new Error("Se requiere user_id o anonymous_uuid")
    }

    // `bookId` es el identificador externo (Gutendex o Book.id de pago); el
    // FK real de ReadingProgress.book_id debe ser el id interno del Book.
    const book = await ensureBookExists(bookId);

    const where = userId
    ? { user_id_book_id: { user_id: userId, book_id: book.id } }
    : { anonymous_uuid_book_id: { anonymous_uuid: anonymousUuid, book_id: book.id } };

    try {
        const progress = await prisma.readingProgress.upsert({
            where,
            update: {
                progress_percentage: progressPercentage,
                last_position: lastPosition,
                updated_at: new Date()
            },
            create: {
                user_id: userId ?? null,
                anonymous_uuid: anonymousUuid ?? null,
                book_id: book.id,
                progress_percentage: progressPercentage,
                last_position: lastPosition
            },
        });
        return progress;
    } catch {
        throw new Error("No se pudo guardar el progreso");
    }
};

const getProgress = async ({ userId, anonymousUuid }) => {
    if (!userId && !anonymousUuid) {
        throw new Error("Se requiere userId o anonymousUuid");
    }

    const where = userId
        ? { user_id: userId }
        : { anonymous_uuid: anonymousUuid };

    const progress = await prisma.readingProgress.findMany({
        where: { ...where, progress_percentage: { lt: 100 } },
        orderBy: { updated_at: "desc" },
        include: {
            book: {
                include: {
                    author: { include: { user: true } },
                    publicDomainAuthor: true,
                },
            },
        },
    });

    return progress.map((p) => ({
        // Id externo con el que el cliente pidió el progreso originalmente:
        // gutendex_id para libros gratuitos, id interno para libros de pago.
        bookId: p.book.gutendex_id ?? p.book_id,
        progressPercentage: Number(p.progress_percentage),
        lastPosition: p.last_position,
        updatedAt: p.updated_at,
        book: {
            id: p.book.id,
            title: p.book.title,
            author: p.book.publicDomainAuthor?.name ?? p.book.author?.user?.name ?? null,
            cover_url: p.book.cover_url,
        },
    }));
};

const syncProgress = async (userId, anonymousUuid) => {
    const update = await prisma.readingProgress.updateMany({
        where: { anonymous_uuid: anonymousUuid },
        data: {
            user_id: userId,
            anonymous_uuid: null,
        },
    });
    return { synced: update.count };
};

export { saveProgress, getProgress, syncProgress };