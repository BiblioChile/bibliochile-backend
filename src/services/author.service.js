import { prisma } from "../prisma/client.js";

const registerAuthor = async (userId, rut, bio, declarationAccepted) => {
    if (!declarationAccepted) {
        throw new Error("Debes aceptar la declaración jurada");
    }

    const existingByUser = await prisma.author.findUnique({ where: { user_id: userId } });
    if (existingByUser) {
        throw new Error("Ya tienes un registro de autor");
    }

    const existingByRut = await prisma.author.findUnique({ where: { rut } });
    if (existingByRut) {
        throw new Error("El RUT ya está registrado");
    }

    const author = await prisma.author.create({
        data: {
            user_id: userId,
            rut,
            bio: bio ?? null,
            declaration_accepted: declarationAccepted,
            status: "pendiente",
        },
    });

    return author;
};

const getAuthorByUserId = async (userId) => {
    const author = await prisma.author.findUnique({ where: { user_id: userId } });
    if (!author) {
        throw new Error("No tienes un registro de autor");
    }
    return author;
};

const uploadBook = async (authorId, bookData) => {
    const author = await prisma.author.findUnique({ where: { id: authorId } });

    if (!author) {
        throw new Error("Autor no encontrado");
    }

    if (author.status !== "aprobado") {
        throw new Error("Tu cuenta de autor aún no ha sido aprobada");
    }

    const { title, contentUrl, coverUrl, description, genreIds } = bookData;

    const book = await prisma.book.create({
        data: {
            title,
            author_id: authorId,
            is_free: false,
            content_url: contentUrl,
            cover_url: coverUrl ?? null,
            description: description ?? null,
            ...(genreIds && genreIds.length > 0
                ? { genres: { create: genreIds.map((genre_id) => ({ genre_id })) } }
                : {}),
        },
    });

    return book;
};

// A diferencia de getAuthorByUserId (que lanza si no existe, pensado para
// rutas que YA requieren ser autor), esta función es para GET /authors/me:
// no existir un Author para este user_id es un estado válido y esperado
// (un pasajero que nunca postuló), no un error — así el frontend puede
// mostrar el estado real de la postulación (pendiente/aprobado/rechazado,
// con motivo) sin depender de requireRole("autor"), que bloquea antes de
// la aprobación.
const getMyAuthorStatus = async (userId) => {
    const author = await prisma.author.findUnique({ where: { user_id: userId } });

    if (!author) {
        return { hasApplication: false };
    }

    return {
        hasApplication: true,
        status: author.status,
        rut: author.rut,
        bio: author.bio,
        rejectionReason: author.rejection_reason,
        rejectionNote: author.rejection_note,
        createdAt: author.created_at,
    };
};

const getMyStats = async (authorId) => {
    const author = await prisma.author.findUnique({ where: { id: authorId } });

    if (!author) {
        throw new Error("Autor no encontrado");
    }

    const books = await prisma.book.findMany({
        where: { author_id: authorId },
        select: { id: true },
    });

    const bookIds = books.map((b) => b.id);

    if (bookIds.length === 0) {
        return {
            totalBooks: 0,
            totalReaders: 0,
            avgProgressPercentage: 0,
            totalRentals: 0,
        };
    }

    const [progressRecords, rentalsCount] = await Promise.all([
        prisma.readingProgress.findMany({
            where: { book_id: { in: bookIds } },
            select: { user_id: true, anonymous_uuid: true, progress_percentage: true },
        }),
        prisma.rental.count({ where: { book_id: { in: bookIds } } }),
    ]);

    const uniqueReaders = new Set(
        progressRecords.map((p) => (p.user_id ? `u:${p.user_id}` : `a:${p.anonymous_uuid}`))
    );

    const avgProgressPercentage =
        progressRecords.length > 0
            ? progressRecords.reduce((sum, p) => sum + Number(p.progress_percentage), 0) / progressRecords.length
            : 0;

    return {
        totalBooks: bookIds.length,
        totalReaders: uniqueReaders.size,
        avgProgressPercentage: Math.round(avgProgressPercentage * 100) / 100,
        totalRentals: rentalsCount,
    };
};

export { registerAuthor, getAuthorByUserId, uploadBook, getMyStats, getMyAuthorStatus };
