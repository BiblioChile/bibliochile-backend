import { prisma } from "../prisma/client.js";

const createRental = async (userId, bookId) => {
    const subscription = await prisma.subscription.findFirst({
        where: { user_id: userId, status: "activa" },
        include: {
            plan: true,
            _count: { select: { rentals: true } },
        },
    });

    if (!subscription) {
        throw new Error("No tienes una suscripción activa");
    }

    const book = await prisma.book.findUnique({ where: { id: bookId } });

    if (!book) {
        throw new Error("Libro no encontrado");
    }

    // Si ya existe un arriendo vigente del mismo libro en esta suscripción,
    // se reutiliza en vez de descontar cupo de nuevo
    const existing = await prisma.rental.findFirst({
        where: {
            user_id: userId,
            book_id: bookId,
            subscription_id: subscription.id,
            expires_at: { gt: new Date() },
        },
    });

    if (existing) {
        return existing;
    }

    if (subscription._count.rentals >= subscription.plan.max_rentals) {
        throw new Error("Has alcanzado el límite de arriendos de tu plan");
    }

    const rental = await prisma.rental.create({
        data: {
            user_id: userId,
            book_id: bookId,
            subscription_id: subscription.id,
            expires_at: subscription.end_date,
        },
    });

    return rental;
};

const getUserRentals = async (userId) => {
    const rentals = await prisma.rental.findMany({
        where: { user_id: userId },
        orderBy: { rented_at: "desc" },
        include: { book: true },
    });

    return rentals.map((rental) => ({
        id: rental.id,
        bookId: rental.book_id,
        rentedAt: rental.rented_at,
        expiresAt: rental.expires_at,
        active: rental.expires_at > new Date(),
        book: {
            id: rental.book.id,
            title: rental.book.title,
            cover_url: rental.book.cover_url,
        },
    }));
};

export { createRental, getUserRentals };
