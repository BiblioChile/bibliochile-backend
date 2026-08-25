### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-006
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                             |
|------------|--------------------------------------------------------------|
| EC-CU-003 / EC-CU-008 | Progreso de lectura anónimo/autenticado y su migración (HU-04, HU-07) |

**Rutas bajo prueba:** `GET /api/progress`, `POST /api/progress`, `POST /api/progress/sync` (`src/routes/progress.routes.js`)
**Archivo de test:** `tests/integration/progress.integration.test.js`
**Base de datos:** Postgres local de Docker + API real de Gutendex (para el auto-sync de `ensureBookExists`)
**Referencia unitaria relacionada:** `EC-PU-003` / `EC-PU-008` (con Prisma y `getBookById` mockeados)

---

### Objetivo general de la prueba

El caso más relevante del módulo (`ensureBookExists` auto-sincronizando un `Book` gratuito la primera vez que se guarda progreso sobre él) depende de una llamada real a Gutendex seguida de un `upsert` real en Postgres — en el test unitario ambas cosas están mockeadas. Esta prueba:

- Confirma que `POST /api/progress` sobre un `bookId` de Gutendex real que **no existe todavía como `Book` local** efectivamente lo crea (`gutendex_id` + `is_free: true`), y que el progreso queda asociado al `id` interno correcto.
- Confirma que ese progreso es recuperable en una petición `GET` siguiente.
- Confirma la migración real de progreso anónimo → cuenta autenticada (`POST /api/progress/sync`), verificando directo en Postgres que la fila cambió de dueño (`user_id` seteado, `anonymous_uuid` a `null`).

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Generar un `anonymousUuid` real con `crypto.randomUUID()`. |
| 2  | Enviar `POST /api/progress` real (golpea Gutendex real la primera vez para el `bookId` usado). |
| 3  | Verificar en Postgres que el `Book` fue creado por `gutendex_id`. |
| 4  | Enviar `GET /api/progress` / `POST /api/progress/sync` reales según el escenario. |
| 5  | Verificar código de estado, cuerpo y estado real en `ReadingProgress` vía Prisma. |
| 6  | Borrar en `afterEach` el progreso/usuario de cada test; borrar en `afterAll` el `Book` auto-sincronizado (se reutiliza entre tests del mismo archivo, no se recrea en cada uno). |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`POST /api/progress` (anónimo, `bookId` de Gutendex real sin `Book` local previo) → `200`; se crea un `Book` real con `gutendex_id` igual al `bookId` enviado. `GET /api/progress?anonymousUuid=...` → `200`, un registro con `progressPercentage: 42`.

#### Escenario 2: Caso inválido
`POST /api/progress` sin `userId` ni `anonymousUuid` → `400 Se requiere user_id o anonymous_uuid` (verificado vía HTTP, no llamando `saveProgress()` directo).

#### Escenario 3: Campos vacíos
`POST /api/progress` con body `{}` → `422`, `errors` incluye `bookId` y `progressPercentage`.

#### Escenario 4: Cruza módulos (progreso anónimo + auth)
Progreso guardado como anónimo, luego el mismo usuario se registra/loguea y llama `POST /api/progress/sync` con su `anonymousUuid` → `200 { synced: 1 }`; confirmado en Postgres que la fila de `ReadingProgress` ahora tiene `user_id` seteado y `anonymous_uuid: null`.

---

### Resultado obtenido

✅ **PASS** — 4/4 tests de `progress.integration.test.js` pasaron en `npx vitest run tests/integration`, incluyendo el auto-sync real contra Gutendex. Datos de prueba eliminados en `afterEach`/`afterAll`.
