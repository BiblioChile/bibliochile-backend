import { prisma } from "../prisma/client.js";
import { getBookById } from "./book.service.js";

const ensureBookExists = async (bookId) => {
    const existing = await prisma.book.findUnique({ where: { id: bookId } });
    if (existing) {
        return existing;
    }

    // El libro no existe localmente. Solo se auto-crea si es un libro gratuito
    // del catálogo público de Gutendex (HU-04). Los libros de pago (autores
    // nacionales) deben existir en Book de antemano vía el flujo de arriendo —
    // si no existen ahí, NO se crean automáticamente acá.
    let gutendexBook;
    try {
        gutendexBook = await getBookById(bookId);
    } catch {
        throw new Error("Libro no encontrado");
    }

    try {
        return await prisma.book.upsert({
            where: { id: bookId },
            update: {},
            create: {
                id: bookId,
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

    await ensureBookExists(bookId);

    const where = userId
    ? { user_id_book_id: { user_id: userId, book_id: bookId } }
    : { anonymous_uuid_book_id: { anonymous_uuid: anonymousUuid, book_id: bookId } };

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
                book_id: bookId,
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
        bookId: p.book_id,
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