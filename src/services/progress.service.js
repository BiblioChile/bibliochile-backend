import { prisma } from "../prisma/client.js";

const saveProgress = async ({userId, anonymousUuid, bookId, progressPercentage, lastPosition}) => {
    if (!userId && !anonymousUuid) {
        throw new Error("Se requiere user_id o anonymous_uuid")
    }

    const where = userId
    ? { user_id_book_id: { user_id: userId, book_id: bookId } }
    : { anonymous_uuid_book_id: { anonymous_uuid: nonymousUuid, book_id: bookId } };

    const progress = await prisma.readingProgress.upsert({
        where,
        update: {
            progress_percentage: progressPercentage,
            last_position: lastPosition,
            update_at: Date()
        },
        create: {
            user_id: userId ?? null,
            anonymous_uuid: anonymousUuid ?? null,
            book_id: bookId,
            progress_percentage: progressPercentage,
            last_position: lastPosition
        },
    });
    return progress
};

const syncProgress = async (userId, anonymousUuid) => {
    const update = await prisma.readingProgress.updateMany({
        where: { anonymous_uuid: anonymousUuid },
        data: {
            user_id: userId,
            anonymous_uuid: null,
        },
    });
    return { synced: updated.count };
};

export { saveProgress, syncProgress };