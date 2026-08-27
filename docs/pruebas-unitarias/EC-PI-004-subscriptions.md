### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-004
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                       |
|------------|---------------------------------------|
| EC-CU-002  | Suscripción a un plan (HU-02)         |

**Rutas bajo prueba:** `GET /api/subscriptions/plans`, `POST /api/subscriptions`, `GET /api/subscriptions/me` (`src/routes/subscription.routes.js`)
**Archivo de test:** `tests/integration/subscriptions.integration.test.js`
**Base de datos:** Postgres local de Docker — usa los planes `mensual`/`anual` sembrados por `prisma/seed.js`
**Referencia unitaria relacionada:** `EC-PU-002` (con Prisma mockeado)

---

### Objetivo general de la prueba

Verificar lo que `EC-PU-002` no puede probar con Prisma mockeado:

- Que una suscripción creada vía `POST /api/subscriptions` sea efectivamente recuperable en una petición **siguiente** (`GET /api/subscriptions/me`), es decir, que la persistencia real y el join con `SubscriptionPlan` funcionen juntos.
- Que la regla "no se puede tener dos suscripciones activas" se cumpla sobre el estado real de la tabla `Subscription`, no sobre un mock de `findFirst`.
- Que el schema Zod rechace la petición HTTP antes de llegar al service.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Registrar y loguear un usuario real vía HTTP (`helpers.registerAndLogin`) para obtener un JWT válido. |
| 2  | Enviar la petición HTTP real con `supertest(app)`. |
| 3  | Verificar el código de estado y el cuerpo. |
| 4  | Confirmar el estado real en Postgres con el `PrismaClient` real donde aplica. |
| 5  | Borrar en `afterEach` el usuario y su(s) suscripción(es). |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`POST /api/subscriptions` con `planId: 1` (mensual, sembrado) → `201`. `GET /api/subscriptions/me` inmediatamente después → `200`, `{ active: true, plan_name: "mensual", max_rentals: 5, rentals_used: 0 }`. Confirmado también contra Postgres: existe una fila en `Subscription` con `status: "activa"`.

#### Escenario 2: Caso inválido
`POST /api/subscriptions` con `planId: 9999` (no sembrado) → `404 Plan no encontrado`.

#### Escenario 3: Campos vacíos
`POST /api/subscriptions` con body `{}` → `422`, `errors` incluye `planId`.

#### Escenario 4: Regla de negocio sobre datos reales
Segunda llamada a `POST /api/subscriptions` (con `planId: 2`) sobre un usuario que ya tiene una suscripción activa persistida → `409 Ya tienes una suscripción activa`; se confirma contra Postgres que sigue existiendo exactamente una fila, no dos.

---

### Resultado obtenido

✅ **PASS** — 4/4 tests de `subscriptions.integration.test.js` pasaron en `npx vitest run tests/integration`. Datos de prueba eliminados en `afterEach`.

---

## EC-PI-004b — `PATCH /api/subscriptions` (cambiar de plan)

**Ruta bajo prueba:** `PATCH /api/subscriptions` (`src/routes/subscription.routes.js`)
**Referencia unitaria relacionada:** `EC-PU-002c` (con Prisma mockeado)

### Objetivo

Verificar contra Postgres real lo que `EC-PU-002c` no puede: que al cambiar de plan queden efectivamente **dos filas** en `Subscription` (la anterior `"cancelada"`, la nueva `"activa"`), que `GET /api/subscriptions/me` refleje el plan nuevo inmediatamente después, y que el caso sin suscripción activa y el caso de plan inexistente se comporten igual que en `POST /api/subscriptions`.

### Evaluación de escenarios

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | Mejor caso — con una suscripción `mensual` activa persistida, `PATCH` a `planId: 2` (anual) | `200`; body con `plan_id: 2`, `status: "activa"`; en Postgres quedan 2 filas (`plan_id: 1` → `"cancelada"`, `plan_id: 2` → `"activa"`); `GET /me` inmediatamente después ya muestra `plan_name: "anual"` |
| 2 | Sin suscripción activa | `201` (mismo comportamiento que `POST /api/subscriptions`); en Postgres queda exactamente 1 fila |
| 3 | `planId` inexistente, con una suscripción activa real de por medio | `404 Plan no encontrado`; la suscripción activa original queda intacta (no se cancela por un intento fallido) |
| 4 | Sin token | `401` |

### Resultado obtenido

✅ **PASS** — 4/4 tests de `EC-PI-004b` (8/8 en `subscriptions.integration.test.js`, 136/136 en la suite completa) en `npx vitest run` del 2026-08-27. Datos de prueba eliminados en `afterEach`.
