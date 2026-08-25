### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-008
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                                          |
|------------|------------------------------------------------------------------------|
| EC-CU-010  | Administración: catálogo gestionable, QR y decisiones de autor (HU-08, HU-09) |

**Rutas bajo prueba:** `POST/GET/PATCH /api/admin/qrcodes`, `GET /api/admin/books`, `PATCH /api/admin/authors/:id/reject` (`src/routes/admin.routes.js`)
**Archivo de test:** `tests/integration/admin.integration.test.js`
**Base de datos:** Postgres local de Docker + API real de Gutendex (validación de `gutendexId` al crear QR)
**Referencia unitaria relacionada:** `EC-PU-010` (con Prisma y `getBookById` mockeados)

---

### Objetivo general de la prueba

Además de repetir el patrón de persistencia real (crear → listar → modificar, todo sobre Postgres real) para QR, esta prueba se enfoca en dos cosas que `EC-PU-010` no puede verificar con mocks:

- Que `requireRole('admin')` bloquee de verdad, vía HTTP, a un usuario autenticado sin ese rol — la nota de `EC-PU-010` decía que esto "se confirma también con prueba manual"; acá queda automatizado.
- El cruce admin + autor: rechazar una postulación con `reason: "otro"` persiste la `note` real en Postgres — la regla de negocio (`rejection_note` solo se guarda cuando `reason === "otro"`) se ejercita sobre una fila de `Author` creada por una petición HTTP real de otro módulo (`POST /api/authors/register`), no sobre un objeto mockeado.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Loguear como admin real (`admin@bibliochile.cl`, sembrado por `seed.js`). |
| 2  | Enviar las peticiones HTTP reales (`POST`/`GET`/`PATCH`) con `supertest(app)`. |
| 3  | Verificar código de estado y cuerpo. |
| 4  | Confirmar el estado real en Postgres (`QRCode`, `Author`) vía Prisma. |
| 5  | Borrar en `afterEach` el QR y/o usuario/autor creados por cada test. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`POST /api/admin/qrcodes` (admin real, `gutendexId` válido) → `201`, persistido en Postgres. `GET /api/admin/qrcodes` siguiente → `200`, incluye el QR recién creado. `PATCH /api/admin/qrcodes/:id` → `200`, `is_active: false`; confirmado directo en Postgres.

#### Escenario 2: Caso inválido
`POST /api/admin/qrcodes` con `gutendexId` inexistente en Gutendex real → `404 El libro de Gutendex no existe`, sin crear nada.

#### Escenario 3: Middleware de rol real
`GET /api/admin/books` con un usuario `"pasajero"` real → `403 No tienes permiso para esta acción`, bloqueado por `requireRole('admin')` antes del service.

#### Escenario 4: Cruza módulos (admin + autor), regla de negocio sobre datos reales
Un autor real (registrado vía `POST /api/authors/register`) es rechazado por el admin con `reason: "otro"` y una `note` → `200`; confirmado en Postgres que `rejection_reason: "otro"` y `rejection_note` quedan guardados tal cual se enviaron.

---

### Resultado obtenido

✅ **PASS** — 4/4 tests de `admin.integration.test.js` pasaron en `npx vitest run tests/integration`. Datos de prueba (QR, usuario y autor) eliminados en `afterEach`.
