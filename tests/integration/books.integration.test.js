// EC-PI-002 — Catálogo de libros (src/routes/book.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-002-books.md
//
// book.service.js no toca Postgres — sirve el catálogo en vivo desde
// Gutendex. Por eso, a diferencia del resto de los módulos, este archivo no
// prueba persistencia local sino la ruta HTTP real contra la API externa
// real (sin mockear node-fetch, como sí hace book.service.test.js) y el
// comportamiento del middleware `optionalAuth` sobre una ruta pública.
import { describe, it, expect } from "vitest";
import { request, app } from "./helpers.js";

// Id real y estable de Gutendex usado también en tests/unit/book.service.test.js.
const REAL_GUTENDEX_ID = 55465;

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
