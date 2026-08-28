// EC-PI-006 — Progreso de lectura (src/routes/progress.routes.js)
// Ver documentación completa en docs/pruebas-unitarias/EC-PI-006-progress.md
//
// Ejercita el auto-sync real de ensureBookExists contra Gutendex (sin
// mockear getBookById, a diferencia de progress.service.test.js) y la
// migración de progreso anónimo → cuenta persistida en Postgres.
import { describe, it, expect, afterEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { request, app, prisma, registerAndLogin, deleteTestUser, deleteBook } from "./helpers.js";

// Id real de Gutendex usado también en tests/unit/progress.service.test.js.
const REAL_GUTENDEX_ID = 55465;

describe("EC-PI-006 · /api/progress (HTTP real contra Postgres + Gutendex)", () => {
  let userId;
  let anonymousUuid;

  afterEach(async () => {
    if (anonymousUuid) {
      await prisma.readingProgress.deleteMany({ where: { anonymous_uuid: anonymousUuid } });
    }
    await deleteTestUser(userId);
    userId = undefined;
    anonymousUuid = undefined;
  });

  // El Book con gutendex_id=REAL_GUTENDEX_ID se auto-sincroniza una sola vez
  // (los tests siguientes lo reutilizan) — se borra al final, no en cada test.
  afterAll(async () => {
    const book = await prisma.book.findUnique({ where: { gutendex_id: REAL_GUTENDEX_ID } });
    await deleteBook(book?.id);
  });

  it("Escenario 1 (mejor caso): guarda progreso anónimo, auto-sincroniza el Book real desde Gutendex y es recuperable vía GET", async () => {
    anonymousUuid = randomUUID();

    const postRes = await request(app).post("/api/progress").send({
      bookId: REAL_GUTENDEX_ID,
      progressPercentage: 42,
      lastPosition: "42%",
      anonymousUuid,
    });

    expect(postRes.status).toBe(200);

    // El Book se creó de verdad en Postgres a partir de la respuesta real
    // de Gutendex — no había fila previa para este gutendex_id.
    const book = await prisma.book.findUnique({ where: { gutendex_id: REAL_GUTENDEX_ID } });
    expect(book).not.toBeNull();
    expect(book.is_free).toBe(true);

    const getRes = await request(app).get("/api/progress").query({ anonymousUuid });
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].bookId).toBe(REAL_GUTENDEX_ID);
    expect(getRes.body[0].progressPercentage).toBe(42);
  });

  it("Escenario 2 (caso inválido): sin userId ni anonymousUuid, la petición HTTP es rechazada (no solo la función aislada)", async () => {
    const res = await request(app).post("/api/progress").send({
      bookId: REAL_GUTENDEX_ID,
      progressPercentage: 10,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Se requiere user_id o anonymous_uuid");
  });

  it("Escenario 3 (campos vacíos): el schema Zod rechaza bookId/progressPercentage ausentes por HTTP", async () => {
    const res = await request(app).post("/api/progress").send({});

    expect(res.status).toBe(422);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["bookId", "progressPercentage"]));
  });

  it("Escenario 4 (cruza módulos: progreso anónimo + auth): sync migra el progreso persistido hacia la cuenta recién logueada", async () => {
    anonymousUuid = randomUUID();
    const { token, user } = await registerAndLogin();
    userId = user.id;

    await request(app).post("/api/progress").send({
      bookId: REAL_GUTENDEX_ID,
      progressPercentage: 15,
      lastPosition: "15%",
      anonymousUuid,
    });

    const syncRes = await request(app)
      .post("/api/progress/sync")
      .set("Authorization", `Bearer ${token}`)
      .send({ anonymousUuid });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body).toEqual({ synced: 1 });

    // Verificado directo contra la BD: la fila cambió de dueño de verdad.
    const migrated = await prisma.readingProgress.findFirst({ where: { user_id: user.id } });
    expect(migrated).not.toBeNull();
    expect(migrated.anonymous_uuid).toBeNull();

    const stillAnonymous = await prisma.readingProgress.findFirst({ where: { anonymous_uuid: anonymousUuid } });
    expect(stillAnonymous).toBeNull();
  });
});
