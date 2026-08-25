// Utilidades compartidas por los tests de integración.
//
// A diferencia de tests/unit (que mockea Prisma), estos tests golpean rutas
// HTTP reales de `app` (src/server.js) contra el Postgres local de Docker
// (mismo DATABASE_URL que usa `npm run dev`). Cada archivo es responsable de
// borrar en su propio afterEach/afterAll lo que haya creado — estas
// funciones solo evitan repetir el orden de borrado (las FK no tienen
// onDelete: Cascade en el schema, así que el orden importa).
import request from "supertest";
import app from "../../src/server.js";
import { prisma } from "../../src/prisma/client.js";

// Email único por test para no chocar con datos ya existentes en la BD
// local (seed + pruebas manuales previas) ni entre corridas paralelas.
const uniqueEmail = (label = "test") =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bibliochile.test`;

// Registra un usuario real vía HTTP y hace login para obtener un JWT
// utilizable en Authorization: Bearer — así cada test parte de un token
// emitido por el flujo real, no de uno armado a mano.
const registerAndLogin = async ({ role = "pasajero", name = "Usuario de prueba" } = {}) => {
  const email = uniqueEmail(role);
  const password = "password123";

  await request(app).post("/api/auth/register").send({ name, email, password, role });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password });

  const user = await prisma.user.findUnique({ where: { email } });

  return { token: loginRes.body.token, user, email, password };
};

// Borra un usuario de prueba y todo lo que pueda depender de él,
// respetando el orden de FK (hijos antes que padres).
const deleteTestUser = async (userId) => {
  if (!userId) return;

  await prisma.rental.deleteMany({ where: { user_id: userId } });
  await prisma.readingProgress.deleteMany({ where: { user_id: userId } });

  const author = await prisma.author.findUnique({ where: { user_id: userId } });
  if (author) {
    const books = await prisma.book.findMany({ where: { author_id: author.id }, select: { id: true } });
    const bookIds = books.map((b) => b.id);
    if (bookIds.length > 0) {
      await prisma.bookGenre.deleteMany({ where: { book_id: { in: bookIds } } });
      await prisma.rental.deleteMany({ where: { book_id: { in: bookIds } } });
      await prisma.readingProgress.deleteMany({ where: { book_id: { in: bookIds } } });
      await prisma.book.deleteMany({ where: { id: { in: bookIds } } });
    }
    await prisma.author.delete({ where: { id: author.id } });
  }

  await prisma.subscription.deleteMany({ where: { user_id: userId } });
  await prisma.qRCode.deleteMany({ where: { created_by: userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {
    // Ya pudo haber sido borrado por otro cleanup en el mismo test — no es un error.
  });
};

const deleteBook = async (bookId) => {
  if (!bookId) return;
  await prisma.bookGenre.deleteMany({ where: { book_id: bookId } });
  await prisma.rental.deleteMany({ where: { book_id: bookId } });
  await prisma.readingProgress.deleteMany({ where: { book_id: bookId } });
  await prisma.book.delete({ where: { id: bookId } }).catch(() => {});
};

export { request, app, prisma, uniqueEmail, registerAndLogin, deleteTestUser, deleteBook };
