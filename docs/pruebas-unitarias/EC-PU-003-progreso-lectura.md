### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-003
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                              |
|------------|--------------------------------------------|
| EC-CU-003  | Guardar progreso de lectura de un libro    |

**Archivo bajo prueba:** `src/services/progress.service.js` (función `saveProgress`)
**Archivo de test:** `tests/unit/progress.service.test.js`
**Schema de validación:** `src/schemas/progress.schema.js` (`progressSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Guardar progreso de lectura**, comprobando que el sistema:

- Guarde (cree o actualice) el progreso cuando viene identificado por `userId` o `anonymousUuid`.
- Rechace el guardado si no viene ninguno de los dos identificadores.
- Valide que `bookId` y `progressPercentage` sean obligatorios antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `saveProgress({ userId, anonymousUuid, bookId, progressPercentage, lastPosition })`. |
| 2  | Mockear `prisma.readingProgress.upsert` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar que el `where` del upsert use la llave compuesta correcta (`user_id_book_id` o `anonymous_uuid_book_id`). |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| bookId               | 123        |
| progressPercentage   | 42         |
| lastPosition         | "42%"      |

**Salida esperada**
- Se invoca `prisma.readingProgress.upsert` con `where: { user_id_book_id: { user_id: 7, book_id: 123 } }`.
- El `update` incluye `progress_percentage: 42` y `updated_at` (fecha vigente).
- El progreso se devuelve correctamente.

#### Escenario 2: Caso inválido

| Campo               | Dato       |
|----------------------|------------|
| userId               | null       |
| anonymousUuid        | null       |
| bookId               | 123        |
| progressPercentage   | 50         |

**Salida esperada**
- Se lanza el error `"Se requiere user_id o anonymous_uuid"`.
- `prisma.readingProgress.upsert` no es invocado.

#### Escenario 3: Campos vacíos

| Campo               | Dato      |
|----------------------|-----------|
| bookId               | (ausente) |
| progressPercentage   | (ausente) |

**Salida esperada**
- `progressSchema.safeParse({})` retorna `success: false`.
- Los errores incluyen los campos `bookId` y `progressPercentage`.
- Esta validación ocurre en la capa de middleware (`validate(progressSchema)`), antes de llegar al servicio.

#### Escenario 4: Libro gratuito nuevo — sincronización automática desde Gutendex por `gutendex_id`

*(agregado 2026-08-20, junto con la migración `20260820233108_add_gutendex_id_to_book` —
ver "Fix: desfase de versión Prisma CLI/client + resolución del riesgo de colisión de ID en Book"
en `DECISIONS.md`)*

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| bookId               | 55465 (id de Gutendex, libro no sincronizado aún) |
| progressPercentage   | 10         |
| lastPosition         | "10%"      |

**Salida esperada**
- `ensureBookExists()` prueba primero `prisma.book.findUnique({ where: { id: bookId } })` y luego
  `prisma.book.findUnique({ where: { gutendex_id: bookId } })`; ambas resuelven `null`.
- Se consulta `BookService.getBookById(bookId)` contra Gutendex.
- Se crea el `Book` vía `prisma.book.upsert({ where: { gutendex_id: bookId }, create: { gutendex_id: bookId, ... } })`
  — **ya no** con `id: bookId` explícito. El `id` interno lo asigna el autoincrement de Postgres,
  desacoplado del id de Gutendex (esto es lo que elimina el riesgo de colisión).
- El `upsert` de `ReadingProgress` usa como `book_id` el **`id` interno** devuelto por `ensureBookExists()`
  (en el test, `501`), no el `bookId` externo (`55465`) — confirma que `saveProgress` ya no asume que
  ambos coinciden.

#### Escenario 5: Libro gratuito ya existente — no vuelve a crear el Book

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| bookId               | 55465 (ya sincronizado, `prisma.book.findUnique` por `id` lo encuentra) |
| progressPercentage   | 20         |
| lastPosition         | "20%"      |

**Salida esperada**
- `getBookById` y `prisma.book.upsert` **no** se invocan — el libro ya existe localmente y
  `ensureBookExists()` lo devuelve en la primera búsqueda, sin llamar a Gutendex.

#### Escenario 6: Libro de pago inexistente — falla sin crear nada

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| bookId               | 999 (no existe localmente ni en Gutendex) |
| progressPercentage   | 5          |

**Salida esperada**
- `ensureBookExists()` no encuentra el libro ni por `id` ni por `gutendex_id`, consulta Gutendex,
  y `getBookById` rechaza con `"Libro no encontrado"`.
- Se lanza `"Libro no encontrado"`; ni `prisma.book.upsert` ni `prisma.readingProgress.upsert` se invocan.
- Cubre el caso de un libro de pago (autor nacional) sin fila en `Book` — mismo comportamiento que
  documenta `RentalService` para libros que nadie registró formalmente.

---

### Resultado obtenido

✅ **PASS** — los 6 tests de `saveProgress` pasaron en la ejecución de `npx vitest run` del
2026-08-20, 23:34 hrs (post-migración `add_gutendex_id_to_book`; el Escenario 4 se reescribió ese
mismo día para reflejar el nuevo contrato `gutendex_id`, ver `DECISIONS.md`).

**Nota:** esta prueba también sirve como regresión del bugfix aplicado en `saveProgress` (campo `update_at` mal escrito y `Date()` sin `new` — ver `DECISIONS.md`), ya que el `expect` del Escenario 1 verifica explícitamente el contenido del `update` enviado a Prisma.

---

## Función `getProgress` (consulta de progreso — HU-04)

### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                          |
|------------|--------------------------------------------------------|
| EC-CU-003  | Consultar / retomar progreso de lectura de un usuario  |

**Archivo bajo prueba:** `src/services/progress.service.js` (función `getProgress`)
**Archivo de test:** `tests/unit/progress.service.test.js`
**Schema de validación:** no aplica — `getProgress` no está validada por un schema Zod; la ruta `GET /` valida la presencia de `userId`/`anonymousUuid` directamente en `progress.controller.js`.

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Consultar progreso de lectura**, comprobando que el sistema:

- Devuelva el listado de progresos (solo los que tienen `progress_percentage < 100`) mapeado al formato esperado por el frontend, cuando viene identificado por `userId` o `anonymousUuid`.
- Rechace la consulta si no viene ninguno de los dos identificadores.
- Devuelva una lista vacía cuando el usuario/anónimo no tiene progresos guardados, sin lanzar error.
- Resuelva el nombre del autor con la prioridad `book.publicDomainAuthor.name` → `book.author.user.name` → `null`.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `getProgress({ userId, anonymousUuid })`. |
| 2  | Mockear `prisma.readingProgress.findMany` según el escenario. |
| 3  | Verificar el resultado devuelto (o el error lanzado). |
| 4  | Confirmar que el `where` del `findMany` use la llave correcta (`user_id` o `anonymous_uuid`) junto a `progress_percentage: { lt: 100 }`, y que el `orderBy` sea `updated_at: "desc"`. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| registros mockeados  | 2 (uno con `publicDomainAuthor`, otro con `author.user`) |

**Salida esperada**
- Se invoca `prisma.readingProgress.findMany` con `where: { user_id: 7, progress_percentage: { lt: 100 } }` y `orderBy: { updated_at: "desc" }`.
- El resultado se mapea a `{ bookId, progressPercentage, lastPosition, updatedAt, book: { id, title, author, cover_url } }`.
- El campo `book.author` toma `publicDomainAuthor.name` cuando existe, y cae a `author.user.name` cuando el libro es de un autor nacional.
- *(desde 2026-08-20)* el campo `bookId` de salida es `book.gutendex_id ?? book_id`: para libros
  gratuitos devuelve el id de Gutendex que el frontend usa para pedir el contenido; para libros de
  pago (sin `gutendex_id`) devuelve el `id` interno. Necesario porque `book_id` (FK real) ahora
  puede diferir del id externo con el que el cliente pidió el progreso — ver Escenario 4 de
  `saveProgress` arriba y `DECISIONS.md`.

#### Escenario 2: Caso inválido

| Campo               | Dato       |
|----------------------|------------|
| userId               | null       |
| anonymousUuid        | null       |

**Salida esperada**
- Se lanza el error `"Se requiere userId o anonymousUuid"`.
- `prisma.readingProgress.findMany` no es invocado.

#### Escenario 3: Campos vacíos

| Campo               | Dato          |
|----------------------|---------------|
| userId               | null          |
| anonymousUuid        | "uuid-anon-1" |
| registros mockeados  | [] (sin progresos guardados) |

**Salida esperada**
- Se invoca `prisma.readingProgress.findMany` con `where: { anonymous_uuid: "uuid-anon-1", progress_percentage: { lt: 100 } }`.
- El servicio devuelve un arreglo vacío `[]` sin lanzar error (usuario/anónimo sin progreso registrado).

---

### Resultado obtenido

✅ **PASS** — los 3 tests de `getProgress` pasaron en la ejecución de `npx vitest run tests/unit/progress.service.test.js` del 2026-08-21, 17:31 hrs (12/12 tests del archivo completo: 6 de `saveProgress` + 3 de `getProgress`, ambos documentados en este EC-PU-003, más 3 de `syncProgress` documentados aparte en `EC-PU-008-migracion-progreso.md`).
