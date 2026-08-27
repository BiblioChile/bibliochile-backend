// EC-PI-002 — Catálogo de libros (src/routes/book.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-002-books.md
//
// book.service.js no toca Postgres — sirve el catálogo en vivo desde
// Gutendex. Por eso, a diferencia del resto de los módulos, este archivo no
// prueba persistencia local sino la ruta HTTP real contra la API externa
// real (sin mockear node-fetch, como sí hace book.service.test.js) y el
// comportamiento del middleware `optionalAuth` sobre una ruta pública.
//
// GET /api/books/paid sí prueba persistencia real — es la excepción: sirve
// el catálogo de pago desde el Book local de Postgres (author.approveAuthor
// + author.uploadBook), no desde Gutendex.
import { describe, it, expect, afterEach } from "vitest";
import { request, app, prisma, registerAndLogin, deleteTestUser, deleteBook } from "./helpers.js";

// Id real y estable de Gutendex usado también en tests/unit/book.service.test.js.
const REAL_GUTENDEX_ID = 55465;

const ADMIN_CREDENTIALS = { email: "admin@bibliochile.cl", password: "admin1234" };

const loginAsAdmin = async () => {
  const res = await request(app).post("/api/auth/login").send(ADMIN_CREDENTIALS);
  return res.body.token;
};

// RUT válido generado para pruebas (dígito verificador correcto) — mismo
// algoritmo usado en author.integration.test.js.
const validRut = () => {
  const body = String(10000000 + Math.floor(Math.random() * 8999999));
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const dv = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return `${body}-${dv}`;
};

describe("EC-PI-002 · GET /api/books (HTTP real contra Gutendex)", () => {
  it("Escenario 1 (mejor caso): lista el catálogo real con la forma esperada", async () => {
    const res = await request(app).get("/api/books").query({ page: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    expect(Array.isArray(res.body.results)).toBe(true);
    if (res.body.results.length > 0) {
      expect(res.body.results[0]).toHaveProperty("id");
      expect(res.body.results[0]).toHaveProperty("is_free", true);
    }
  });

  it("Escenario 2 (caso inválido): id inexistente en Gutendex devuelve 404 real, no mockeado", async () => {
    const res = await request(app).get("/api/books/999999999");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Libro no encontrado");
  });

  it("Escenario 3 (middleware transversal): optionalAuth no bloquea la ruta pública ni con token inválido", async () => {
    const res = await request(app)
      .get(`/api/books/${REAL_GUTENDEX_ID}`)
      .set("Authorization", "Bearer token-invalido-que-no-deberia-bloquear");

    // optionalAuth traga el error del token y sigue como anónimo — solo
    // verificable con la app completa, no con la función aislada.
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(REAL_GUTENDEX_ID);
  });
});

describe("EC-PI-002b · GET /api/books/paid (HTTP real contra Postgres)", () => {
  let userId;
  let bookId;
  let orphanBookId;

  afterEach(async () => {
    await deleteTestUser(userId);
    await deleteBook(orphanBookId);
    userId = undefined;
    bookId = undefined;
    orphanBookId = undefined;
  });

  it("Escenario 1 (mejor caso): lista un Book local de pago de un autor aprobado, con el nombre del autor real", async () => {
    const { token, user } = await registerAndLogin({ role: "autor", name: "Autora Paga" });
    userId = user.id;

    await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), declarationAccepted: true });

    const author = await prisma.author.findUnique({ where: { user_id: userId } });
    const adminToken = await loginAsAdmin();
    await request(app)
      .patch(`/api/admin/authors/${author.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    // El JWT viejo no refleja la aprobación (comportamiento documentado en
    // EC-PI-007) — hace falta un re-login para obtener un token con role: "autor".
    const relogin = await request(app).post("/api/auth/login").send({ email: user.email, password: "password123" });
    const uploadRes = await request(app)
      .post("/api/authors/books")
      .set("Authorization", `Bearer ${relogin.body.token}`)
      .send({ title: "Obra Paga EC-PI-002b", contentUrl: "https://example.com/obra.html", description: "Una obra de pago" });

    bookId = uploadRes.body.id;

    const res = await request(app).get("/api/books/paid");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("count");
    const found = res.body.results.find((b) => b.id === bookId);
    expect(found).toBeTruthy();
    expect(found).toMatchObject({
      title: "Obra Paga EC-PI-002b",
      author: "Autora Paga",
      description: "Una obra de pago",
      is_free: false,
    });
  });

  it("Escenario 2 (caso inválido): no requiere autenticación — accesible sin token, y no filtra libros gratuitos de Gutendex", async () => {
    const res = await request(app).get("/api/books/paid");

    expect(res.status).toBe(200);
    // Ningún resultado del catálogo de pago debe venir marcado is_free true.
    expect(res.body.results.every((b) => b.is_free === false)).toBe(true);
  });

  it("Escenario 3 (campos vacíos): un Book de pago sin autor asociado cae a 'Autor desconocido' en vez de romper la ruta", async () => {
    const orphan = await prisma.book.create({
      data: { title: "Obra Huérfana EC-PI-002b", is_free: false, content_url: "https://example.com/huerfana.html" },
    });
    orphanBookId = orphan.id;

    const res = await request(app).get("/api/books/paid");

    expect(res.status).toBe(200);
    const found = res.body.results.find((b) => b.id === orphanBookId);
    expect(found).toBeTruthy();
    expect(found.author).toBe("Autor desconocido");
  });
});

describe("EC-PI-002c · GET /api/books/:id — fix de colisión de id local vs. Gutendex", () => {
  // Reproduce exactamente el bug reportado en
  // env/Prompt_fix_getbookbyid_coleccion.md: un libro de pago con id
  // autoincrement de Postgres devolvía silenciosamente el libro de Gutendex
  // con ese mismo id numérico, saltándose el control de acceso de Rental
  // (el libro de pago se veía como is_free: true).
  let userId;
  let bookId;

  afterEach(async () => {
    await deleteTestUser(userId);
    await deleteBook(bookId);
    userId = undefined;
    bookId = undefined;
  });

  it("Escenario 1 (mejor caso, repite el bug real): GET /books/:id de un libro de pago local devuelve ESE libro, con is_free: false — no uno de Gutendex", async () => {
    const { token, user } = await registerAndLogin({ role: "autor", name: "Autora Colisión" });
    userId = user.id;

    await request(app)
      .post("/api/authors/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ rut: validRut(), declarationAccepted: true });

    const author = await prisma.author.findUnique({ where: { user_id: userId } });
    const adminToken = await loginAsAdmin();
    await request(app)
      .patch(`/api/admin/authors/${author.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    const relogin = await request(app).post("/api/auth/login").send({ email: user.email, password: "password123" });
    const uploadRes = await request(app)
      .post("/api/authors/books")
      .set("Authorization", `Bearer ${relogin.body.token}`)
      .send({ title: "Obra de Pago EC-PI-002c", contentUrl: "https://example.com/obra-pago.html", description: "No debe verse como gratis" });

    bookId = uploadRes.body.id;

    const res = await request(app).get(`/api/books/${bookId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: bookId,
      title: "Obra de Pago EC-PI-002c",
      author: "Autora Colisión",
      is_free: false,
    });
  });

  it("Escenario 2 (caso borde): un libro gratuito ya sincronizado localmente (id interno, no gutendex_id) se sigue sirviendo bien vía GET /books/:id", async () => {
    const synced = await prisma.book.create({
      data: {
        title: "Libro Gratuito Ya Sincronizado",
        is_free: true,
        gutendex_id: 900000001,
        content_url: "https://gutendex.com/books/900000001.html",
      },
    });
    bookId = synced.id;

    const res = await request(app).get(`/api/books/${bookId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(bookId);
    expect(res.body.is_free).toBe(true);
  });

  it("Escenario 3 (verificación de no-regresión): un id sin Book local sigue resolviendo contra Gutendex real, como antes del fix", async () => {
    const res = await request(app).get(`/api/books/${REAL_GUTENDEX_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(REAL_GUTENDEX_ID);
    expect(res.body.is_free).toBe(true);
  });
});
