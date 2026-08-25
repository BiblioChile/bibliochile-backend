### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-007
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                     |
|------------|--------------------------------------|
| EC-CU-009  | Perfil y flujo de autor (HU-06)      |

**Rutas bajo prueba:** `POST /api/authors/register`, `POST /api/authors/books`, `GET /api/authors/me/stats` (`src/routes/author.routes.js`), más `PATCH /api/admin/authors/:id/approve` (`src/routes/admin.routes.js`) para completar el flujo cruzado
**Archivo de test:** `tests/integration/author.integration.test.js`
**Base de datos:** Postgres local de Docker
**Referencia unitaria relacionada:** `EC-PU-009` (con Prisma mockeado)

---

### Objetivo general de la prueba

Este es el caso "cruza más de un módulo" pedido explícitamente para Fase 4: el rechazo de `uploadBook` mientras el autor está pendiente, y su posterior éxito tras la aprobación, solo se pueden confirmar reales cuando el estado de `Author.status` persiste entre una petición y la siguiente — con Prisma mockeado (como en `EC-PU-009`) cada test parte de un estado fijo, no de una transición real. Esta prueba también confirma:

- Que `requireRole('autor')` bloquee de verdad, vía HTTP, a un usuario cuyo JWT no tiene ese rol — sin importar si ya tiene o no un registro de `Author`.
- Que el schema Zod del RUT chileno rechace un RUT inválido por HTTP, sin necesidad de invocar `isValidRut()` de forma aislada.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Registrar y loguear un usuario real con `role: "autor"` en el JWT. |
| 2  | `POST /api/authors/register` real → autor queda `"pendiente"` en Postgres. |
| 3  | `POST /api/authors/books` real (debe fallar mientras está pendiente). |
| 4  | Loguear como admin real (`admin@bibliochile.cl`, sembrado por `seed.js`) y `PATCH /api/admin/authors/:id/approve` real. |
| 5  | Repetir `POST /api/authors/books` (debe ahora persistir un `Book` real) y `GET /api/authors/me/stats`. |
| 6  | Borrar en `afterEach` el usuario, su `Author` y los `Book`s creados. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso (cruza autenticación + autor + admin)
Registro de autor → `201`, `status: "pendiente"` real en Postgres. `POST /api/authors/books` antes de aprobar → `403 Tu cuenta de autor aún no ha sido aprobada`. `PATCH /api/admin/authors/:id/approve` (admin real) → `200`, `status: "aprobado"`. La misma petición de subida, repetida después → `201`, `Book` real persistido con `author_id` correcto e `is_free: false`. `GET /api/authors/me/stats` → `200`, `totalBooks: 1`.

#### Escenario 2: Caso inválido
`POST /api/authors/register` con `rut: "123-4"` (formato inválido) → `422`, `errors` incluye `rut`; se confirma que no se creó ningún `Author` en Postgres.

#### Escenario 3: Middleware de rol real
Usuario autenticado con `role: "pasajero"` intenta `POST /api/authors/books` → `403 No tienes permiso para esta acción`, bloqueado por `requireRole` antes de llegar al service — independiente de si existe o no un registro de `Author`.

#### Escenario 4 (agregado 2026-08-25): flujo real de promoción `pasajero` → `autor`
A diferencia del Escenario 1 (que arranca con `role: "autor"` ya autodeclarado en el registro,
para poder probar el gate de `Author.status` de forma aislada), este escenario registra un
`pasajero` real y sigue el flujo completo pensado por el producto: declara autoría, es aprobado
por el admin, y solo entonces puede usar rutas de autor. Existe porque expuso un bug real:
`approveAuthor()` actualizaba `Author.status` pero nunca `User.role`, así que un autor aprobado
por este camino se quedaba bloqueado para siempre por `requireRole('autor')`.

- `POST /api/authors/register` con el usuario `pasajero` → `201`, `status: "pendiente"`; `User.role`
  sigue siendo `"pasajero"` en la BD.
- `GET /api/authors/me/stats` con el token de ese login (role `"pasajero"` en el JWT) → `403 No
  tienes permiso para esta acción` — bloqueado por `requireRole`, ni siquiera llega al service.
- Admin real aprueba (`PATCH /api/admin/authors/:id/approve`) → `200`. Se confirma contra la BD que
  `User.role` ya es `"autor"`.
- **Con el mismo token de antes de la aprobación**, la misma ruta sigue en `403` — el JWT es un
  artefacto firmado en el momento del login, no se actualiza solo cuando cambia el `role` en la BD.
- Con un **login nuevo** (JWT fresco, ya con `role: "autor"`) la misma ruta responde `200`,
  `totalBooks: 0`.

Esto confirma tanto el fix (`User.role` sí se actualiza) como una consecuencia esperada del diseño
con JWT (hay que volver a loguearse para que el nuevo rol tenga efecto) — no es un bug adicional,
es el comportamiento correcto de un token firmado.

---

### Resultado obtenido

✅ **PASS** — 3/3 tests de `author.integration.test.js` pasaron en `npx vitest run tests/integration`. Datos de prueba (usuario, autor y libro) eliminados en `afterEach`.

**Actualización 2026-08-25 — fix de `approveAuthor` (`User.role` no se actualizaba):** se agregó el
Escenario 4 arriba. 4/4 tests de `author.integration.test.js` en verde contra la BD local real
(Postgres, mismo `DATABASE_URL` que `npm run dev`). Suite completa del backend: 111/111 tests, 17
archivos. Verificación manual adicional por HTTP directo (`curl`) con el mismo resultado. Datos de
prueba eliminados en `afterEach` y al finalizar la verificación manual.
