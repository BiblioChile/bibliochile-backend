### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-005
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                      |
|------------|---------------------------------------------------|
| EC-CU-005  | Explorar catálogo de libros y lector integrado    |

**Archivo bajo prueba:** `src/services/book.service.js` (funciones `getBooks`, `getBookById`, `getPaidBooks`)
**Archivo de test:** `tests/unit/book.service.test.js`
**Schema de validación:** no aplica — `search`, `genre` y `page` son query params opcionales, sin schema Zod en la ruta (`GET /api/books`); `getPaidBooks` no recibe input.

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Explorar catálogo**, comprobando que el sistema:

- Consulte la API de Gutendex y devuelva los libros mapeados al formato interno.
- Rechace la búsqueda cuando Gutendex no responde correctamente (`getBooks`) o el libro no existe (`getBookById`).
- Funcione sin filtros, usando solo los parámetros por defecto (`languages=es`, `page=1`).

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `getBooks({ search, genre, page })` o `getBookById(id)` según el escenario. |
| 2  | Mockear `fetch` (paquete `node-fetch`) con la respuesta simulada de Gutendex. |
| 3  | Verificar el resultado mapeado o el error lanzado. |
| 4  | Confirmar la URL con la que se invocó `fetch` (filtros aplicados o ausentes). |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo  | Dato              |
|--------|-------------------|
| search | "martin rivas"    |
| page   | 1                 |

**Salida esperada**
- `fetch` es invocado con `search=martin+rivas` en la URL.
- Se devuelve `{ count, next, previous, results }` con cada libro mapeado (`id`, `title`, `author`, `description`, `cover_url`, `content_url`, `is_free`).
- No se lanza ninguna excepción.

#### Escenario 2: Caso inválido

| Campo | Dato                          |
|-------|--------------------------------|
| id    | 999999 (no existe ni local ni en Gutendex) |

**Salida esperada**
- `getBookById` primero consulta `prisma.book.findUnique` (mockeado a `null`) y, al no encontrarlo local, lanza el error `"Libro no encontrado"` cuando la respuesta de Gutendex tampoco es `ok`.

Variante 2b: `getBooks` con la API de Gutendex no disponible (`response.ok === false`) → lanza `"Error al conectar con Gutendex"`.

#### Escenario 3: Campos vacíos

| Campo  | Dato      |
|--------|-----------|
| search | (ausente) |
| genre  | (ausente) |
| page   | (default) |

**Salida esperada**
- `getBooks({})` no lanza error — usa solo `languages=es&page=1` en la URL.
- La URL no contiene `search=` ni `topic=`.
- No aplica un schema Zod porque los filtros son opcionales por naturaleza: no hay un "campo obligatorio vacío" que rechazar, se prueba que el servicio tolera la ausencia de filtros.

---

### EC-PU-005b — `getPaidBooks` (catálogo de pago local)

Agregada 2026-08-26 junto con `GET /api/books/paid` (ver `env/Prompt_backend_libros_pago.md`) — cierra el hueco de arquitectura donde los libros de pago subidos por autores nacionales (viven en el `Book` local de Postgres) nunca aparecían en ningún listado, porque `getBooks`/`getBookById` solo consultan Gutendex y jamás tocan Prisma.

**Archivo bajo prueba:** `src/services/book.service.js` (función `getPaidBooks`)
**Mock:** `prisma.book.findMany` (mismo patrón de `vi.mock("../../src/prisma/client.js", ...)` que el resto de `tests/unit/*.service.test.js`)

#### Escenario 1: Mejor caso
`prisma.book.findMany` devuelve un `Book` con `is_free: false` y relación `author.user.name` cargada → `getPaidBooks()` llama a `findMany` con `where: { is_free: false }` y devuelve `{ count: 1, results: [{ id, title, author: <nombre real del autor>, description, cover_url, content_url, is_free: false }] }` — mismo shape de objeto que usa `getBooks` para el catálogo gratuito, para que el frontend pueda reusar el mismo componente de card.

#### Escenario 2: Caso inválido
Un `Book` sin relación `author` cargada (autor borrado o dato inconsistente) no rompe el mapeo — cae a `"Autor desconocido"`, igual que el fallback ya existente en `mapBook` para Gutendex.

#### Escenario 3: Campos vacíos
`prisma.book.findMany` devuelve `[]` (sin libros de pago publicados todavía) → `getPaidBooks()` devuelve `{ count: 0, results: [] }`, no lanza error.

---

### EC-PU-005c — Fix de colisión de id: `getBookById` prioriza el Book local

Agregada 2026-08-27 (ver `env/Prompt_fix_getbookbyid_coleccion.md`) — bug crítico real:
un libro de pago con `id` autoincrement de Postgres colisionaba con un id real de
Gutendex, devolviendo el libro equivocado con `is_free: true` y saltándose el control
de acceso de Rental. Mismo patrón que ya usa `ensureBookExists()`
(`progress.service.js`): buscar primero local, caer a Gutendex solo si no existe ahí.

**Archivo bajo prueba:** `src/services/book.service.js` (función `getBookById`, reescrita)
**Mock:** `prisma.book.findUnique` además de `fetch`

#### Escenario 1: Mejor caso
`prisma.book.findUnique` devuelve un `Book` de pago (`is_free: false`) → `getBookById()`
devuelve ese libro mapeado (`author` vía `Author.user.name`), y **`fetch` no se invoca en
absoluto** (`expect(fetch).not.toHaveBeenCalled()`) — confirma que ya no cae a Gutendex
cuando el libro existe localmente.

#### Escenario 2: Caso borde
Un libro **gratuito** ya sincronizado localmente (`is_free: true`, con `id` interno
distinto de su `gutendex_id`) también se sirve ahora desde Postgres por el id interno —
`is_free` se mantiene `true`, sin romper el flujo de acceso gratuito.

#### Escenario 3: Campos vacíos / no numérico
Un `id` no numérico (p. ej. un string arbitrario) nunca se consulta contra Prisma con
`NaN` — `prisma.book.findUnique` no se invoca, y la función cae directo a Gutendex como
antes del fix.

---

### Resultado obtenido

✅ **PASS** — los 4 tests originales del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-07.
✅ **PASS** — los 3 tests nuevos de EC-PU-005b pasaron en `npx vitest run tests/unit/book.service.test.js` del 2026-08-26.
✅ **PASS** — los 3 tests nuevos de EC-PU-005c pasaron en `npx vitest run tests/unit/book.service.test.js` del 2026-08-27 (10/10 tests del archivo en total).
