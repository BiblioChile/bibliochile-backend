### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-002
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                          |
|------------|----------------------------------------|
| EC-CU-005  | Explorar catálogo de libros (HU-04)    |

**Rutas bajo prueba:** `GET /api/books`, `GET /api/books/:id`, `GET /api/books/paid` (`src/routes/book.routes.js`)
**Archivo de test:** `tests/integration/books.integration.test.js`
**Base de datos:** ninguna — `book.service.js` no toca Postgres, sirve el catálogo en vivo desde Gutendex
**Referencia unitaria relacionada:** `EC-PU-005` (con `node-fetch` mockeado)

---

### Objetivo general de la prueba

`book.service.js` es el único módulo del backend sin persistencia local, así que esta prueba no verifica escritura en Postgres como el resto de `EC-PI-*` — verifica:

- Que la ruta HTTP real, sin mockear `node-fetch`, golpee la API real de Gutendex y devuelva el catálogo con la forma que el frontend espera.
- Que un id inexistente en Gutendex real (no simulado con `{ ok: false }`) resulte en el mismo `404` que el test unitario verifica de forma aislada.
- Que `optionalAuth` realmente no bloquee la ruta pública cuando el token es inválido — comportamiento de middleware que solo se observa con la app completa montada.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Enviar la petición HTTP real con `supertest(app)`, sin mockear `fetch`. |
| 2  | Esperar la respuesta real de `gutendex.com`. |
| 3  | Verificar el código de estado y la forma del cuerpo de la respuesta. |

No requiere limpieza de datos — no se persiste nada.

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`GET /api/books?page=1` → `200`, `count` numérico, `results` es un array; si trae resultados, cada uno tiene `id` e `is_free: true`.

#### Escenario 2: Caso inválido
`GET /api/books/999999999` (id que no existe en Gutendex) → `404 Libro no encontrado`, obtenido de una respuesta real de la API, no de un mock `{ ok: false }`.

#### Escenario 3: Middleware transversal
`GET /api/books/55465` con `Authorization: Bearer token-invalido-que-no-deberia-bloquear` → `200` — `optionalAuth` descarta el token inválido y sigue como anónimo, sin bloquear la ruta pública.

---

### Resultado obtenido

✅ **PASS** — 3/3 tests de `books.integration.test.js` pasaron en `npx vitest run tests/integration`, contra la API real de Gutendex.

**Nota:** esta suite depende de que `gutendex.com` esté disponible al momento de correr los tests — es la única excepción a "todo contra Postgres local" del resto de `EC-PI-*`, porque no existe una capa de persistencia local que probar en este módulo.

---

### EC-PI-002b — `GET /api/books/paid` (catálogo de pago, HTTP real contra Postgres)

Agregada 2026-08-26 (ver `env/Prompt_backend_libros_pago.md`) — a diferencia del resto de este archivo, esta ruta sí toca Postgres, así que sí prueba persistencia real y cruza módulos: registro de autor → aprobación admin real → subida de obra → aparece en el catálogo de pago, sin sesión.

**Ruta:** `GET /api/books/paid`, pública (sin `optionalAuth` ni `verifyToken` — el catálogo de pago debe verse sin sesión; la sesión solo se necesita para arrendar/leer).
**Referencia unitaria relacionada:** `EC-PU-005b`.

#### Escenario 1: Mejor caso
Flujo cruzado completo por HTTP real: registro de autor → `POST /api/authors/register` → aprobación con el admin sembrado (`PATCH /api/admin/authors/:id/approve`) → re-login (token fresco, ver nota de JWT en `EC-PI-007`) → `POST /api/authors/books` → `GET /api/books/paid` incluye la obra recién publicada, con `author` igual al nombre real del `User` (vía join `Book.author → Author.user`), `is_free: false`.

#### Escenario 2: Caso inválido
`GET /api/books/paid` sin `Authorization` → `200` (no requiere sesión, a diferencia de rutas que si la exigen); todos los resultados devueltos vienen con `is_free: false` — la ruta nunca mezcla el catálogo de pago con resultados gratuitos de Gutendex.

#### Escenario 3: Campos vacíos
Un `Book` de pago creado directo en Postgres sin `author_id` (dato huérfano, caso límite no esperado en el flujo normal pero posible por datos legado) → la ruta no rompe, cae a `"Autor desconocido"` igual que el test unitario `EC-PU-005b`.

**Limpieza:** usuario/autor/obra de prueba borrados en `afterEach` vía `deleteTestUser`/`deleteBook` (helpers.js); confirmado con conteo de filas antes/después.

**Resultado:** ✅ **6/6 tests de `books.integration.test.js`** (3 originales de EC-PI-002 + 3 de EC-PI-002b) pasaron en `npx vitest run tests/integration` del 2026-08-26. Suite completa del backend: 117/117 tests, 17 archivos.

---

### EC-PI-002c — Fix de colisión de id: `GET /api/books/:id` prioriza el Book local

Agregada 2026-08-27 (ver `env/Prompt_fix_getbookbyid_coleccion.md`) — reproduce
**exactamente** la secuencia real que encontró el bug en producción/pruebas manuales:
`POST /authors/books` creó un libro con `id: 51`, `GET /books/paid` lo traía correcto,
pero `GET /books/51` devolvía "Anne of the Island" de Gutendex — un libro
completamente distinto, con `is_free: true`, saltándose el control de acceso de Rental.

**Referencia unitaria relacionada:** `EC-PU-005c`.

#### Escenario 1: Mejor caso (repite el bug real)
Flujo cruzado completo por HTTP real: registro de autor → aprobación admin real →
re-login → `POST /api/authors/books` → `GET /api/books/:id` con el `id` real devuelto
por la subida → `200` con el libro correcto (`title`, `author` real, `is_free: false`),
no uno de Gutendex.

#### Escenario 2: Caso borde
Un `Book` gratuito creado directo en Postgres con `is_free: true` y un `gutendex_id`
propio (simulando uno ya sincronizado antes por `ensureBookExists()`) → `GET
/api/books/:id` con su **id interno** también resuelve bien, `is_free: true` intacto —
confirma que el fix no rompe el acceso a libros gratuitos ya sincronizados.

#### Escenario 3: Verificación de no-regresión
`GET /api/books/55465` (id real de Gutendex, sin `Book` local con ese id) → sigue
resolviendo contra Gutendex real como antes del fix, `is_free: true`.

**Limpieza:** usuario/autor/obra de prueba borrados en `afterEach` (mismos helpers).

**Resultado:** ✅ **9/9 tests de `books.integration.test.js`** (6 anteriores + 3 de
EC-PI-002c) pasaron en `npx vitest run tests/integration --testTimeout=15000` del
2026-08-27. Suite completa del backend: 123/123 tests, 17 archivos.
