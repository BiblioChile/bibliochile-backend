import { prisma } from "../prisma/client.js";
import { getBookById } from "./book.service.js";

// Libros gestionables por el admin: solo los que existen localmente
// (autores nacionales vía author_id + gratuitos ya sincronizados vía gutendex_id).
// El catálogo completo de Gutendex nunca se persiste, así que nunca aparece acá.
const listManagedBooks = async () => {
  const books = await prisma.book.findMany({
    where: {
      OR: [{ author_id: { not: null } }, { gutendex_id: { not: null } }],
    },
    orderBy: { created_at: "desc" },
    include: {
      author: { include: { user: { select: { name: true } } } },
    },
  });

  return books;
};

const nextQRCode = async () => {
  const count = await prisma.qRCode.count();
  return `BCH-${String(count + 1).padStart(3, "0")}`;
};

const createQRCode = async (locationName, gutendexId, createdBy) => {
  try {
    await getBookById(gutendexId);
  } catch {
    throw new Error("El libro de Gutendex no existe");
  }

  const code = await nextQRCode();

  const qr = await prisma.qRCode.create({
    data: {
      code,
      location_name: locationName,
      gutendex_id: gutendexId,
      created_by: createdBy,
    },
  });

  return qr;
};

const listQRCodes = async () => {
  const qrCodes = await prisma.qRCode.findMany({
    orderBy: { created_at: "desc" },
  });

  return qrCodes;
};

const toggleQRCode = async (id) => {
  const qr = await prisma.qRCode.findUnique({ where: { id } });

  if (!qr) {
    throw new Error("QR no encontrado");
  }

  const updated = await prisma.qRCode.update({
    where: { id },
    data: { is_active: !qr.is_active },
  });

  return updated;
};

const listPendingAuthors = async () => {
  const authors = await prisma.author.findMany({
    where: { status: "pendiente" },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { created_at: "asc" },
  });

  return authors;
};

const approveAuthor = async (authorId) => {
  const author = await prisma.author.findUnique({ where: { id: authorId } });

  if (!author) {
    throw new Error("Autor no encontrado");
  }

  // Las vistas/rutas de autor están gateadas por User.role === "autor", no
  // por Author.status — hay que actualizar ambos o un autor aprobado sigue
  // sin poder usarlas. Transacción para que no queden desincronizados si
  // uno de los dos updates falla.
  const [updated] = await prisma.$transaction([
    prisma.author.update({
      where: { id: authorId },
      data: { status: "aprobado", rejection_reason: null, rejection_note: null },
    }),
    prisma.user.update({
      where: { id: author.user_id },
      data: { role: "autor" },
    }),
  ]);

  return updated;
};

// A diferencia de approveAuthor, este no toca User.role: un rechazo no debe
// promover a nadie, así que el usuario simplemente se queda como "pasajero"
// (o con el role que ya tuviera si se autodeclaró "autor" en /auth/register,
// caso que este flujo de aprobación/rechazo no controla).
const rejectAuthor = async (authorId, reason, note) => {
  const author = await prisma.author.findUnique({ where: { id: authorId } });

  if (!author) {
    throw new Error("Autor no encontrado");
  }

  const updated = await prisma.author.update({
    where: { id: authorId },
    data: {
      status: "rechazado",
      rejection_reason: reason,
      rejection_note: reason === "otro" ? (note ?? null) : null,
    },
  });

  return updated;
};

export {
  listManagedBooks,
  createQRCode,
  listQRCodes,
  toggleQRCode,
  listPendingAuthors,
  approveAuthor,
  rejectAuthor,
};
