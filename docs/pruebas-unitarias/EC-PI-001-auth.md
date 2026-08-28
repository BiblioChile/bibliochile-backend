### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-001
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                   |
|------------|------------------------------------------------|
| EC-CU-001  | Registro y autenticación de usuarios (HU-01)   |

**Rutas bajo prueba:** `POST /api/auth/register`, `POST /api/auth/login` (`src/routes/auth.routes.js`)
**Archivo de test:** `tests/integration/auth.integration.test.js`
**Base de datos:** Postgres local de Docker (`bibliochile-pg`), sin mockear Prisma
**Referencia unitaria relacionada:** `EC-PU-001` (login, con Prisma mockeado) — acá no se repite la lógica de negocio aislada, solo lo que solo se puede verificar con la app HTTP completa.

---

### Objetivo general de la prueba

A diferencia de `EC-PU-001`, esta prueba no mockea Prisma ni llama las funciones del service directamente — usa `supertest` contra la instancia real de Express (`src/server.js`) y el Postgres local, para verificar:

- Que el pipeline completo `route → validate(Zod) → controller → service → Postgres` funcione de punta a punta: un registro real persiste en la tabla `User`, y el login siguiente puede leer esa fila y emitir un JWT válido.
- Que ese JWT, usado en una ruta protegida distinta (`GET /api/subscriptions/me`), sea aceptado de verdad por `verifyToken` — no solo que la función de verificación funcione en aislamiento.
- Que el middleware de validación (`validate(schema)`) rechace peticiones mal formadas **antes** de que lleguen al controller/service, algo que un test unitario del service no puede observar porque nunca pasa por el middleware.
- Que una ruta protegida bloquee de verdad sin token o con un token corrupto.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Levantar `app` importándola desde `src/server.js` (sin abrir un puerto real — ver nota de infraestructura). |
| 2  | Enviar la petición HTTP real con `supertest(app)`. |
| 3  | Verificar el código de estado y el cuerpo de la respuesta. |
| 4  | Consultar Postgres directamente con el `PrismaClient` real para confirmar persistencia. |
| 5  | Borrar en `afterEach` cualquier usuario creado por el test. |

**Nota de infraestructura:** `src/server.js` llamaba `app.listen()` incondicionalmente al importarse, lo que habría hecho colisionar el puerto entre los 8 archivos de integración. Se agregó un guard (`if` sobre si el módulo se ejecuta como programa principal) para que `node src/server.js` siga levantando el puerto real, pero importar `app` desde un test no lo haga.

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`POST /api/auth/register` con datos válidos → `201`, fila creada en `User` con `role: "pasajero"`. `POST /api/auth/login` con las mismas credenciales → `200` con `token`. Ese `token` usado en `GET /api/subscriptions/me` → `200` (el JWT real es aceptado por `verifyToken`).

#### Escenario 2: Caso inválido
`POST /api/auth/register` con `email` no válido y `password` corta → `422 Error de validación` con `errors` para `name`, `email` y `password` — rechazado por el schema Zod vía HTTP, y se confirma que no se creó ninguna fila en `User`.

#### Escenario 3: Campos vacíos
`POST /api/auth/login` con body `{}` → `422`, con `errors` para `email` y `password`.

#### Escenario 4: Middleware transversal
`GET /api/subscriptions/me` sin header `Authorization` → `401`. Con `Authorization: Bearer esto-no-es-un-jwt-valido` → `401`.

---

### Resultado obtenido

✅ **PASS** — 4/4 tests de `auth.integration.test.js` pasaron en `npx vitest run tests/integration`. Datos de prueba (usuario creado en Escenario 1) eliminados en `afterEach`; la BD local queda igual que antes de correr la suite.
