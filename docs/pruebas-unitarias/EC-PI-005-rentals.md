### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-005
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                |
|------------|--------------------------------|
| EC-CU-004  | Arriendo de un libro (HU-03)   |

**Rutas bajo prueba:** `POST /api/rentals`, `GET /api/rentals/me` (`src/routes/rental.routes.js`)
**Archivo de test:** `tests/integration/rentals.integration.test.js`
**Base de datos:** Postgres local de Docker
**Referencia unitaria relacionada:** `EC-PU-004` (con Prisma mockeado)

---

### Objetivo general de la prueba

`createRental` depende de tres tablas relacionadas (`Subscription`, `Book`, `Rental`) — el escenario "mejor caso" solo tiene sentido real cuando las tres existen y se relacionan de verdad en Postgres, algo que el test unitario prueba con cada tabla mockeada por separado. Esta prueba:

- Crea una suscripción real vía `POST /api/subscriptions`, un `Book` de pago real vía Prisma directo (el flujo de arriendo nunca crea `Book`s — deben existir de antemano, por diseño, ver `DECISIONS.md`), y arrienda ese libro vía `POST /api/rentals`.
- Confirma que el arriendo aparece en `GET /api/rentals/me` en una petición siguiente, con el libro embebido.
- Confirma sobre datos reales que re-arrendar el mismo libro no duplica la fila (reutiliza cupo en vez de descontarlo de nuevo).

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Registrar y loguear un usuario real vía HTTP. |
| 2  | Crear un `Book` de pago directo con el `PrismaClient` real (fixture, no expuesto por ninguna ruta pública). |
| 3  | Suscribir al usuario vía `POST /api/subscriptions` cuando el escenario lo requiere. |
| 4  | Enviar `POST /api/rentals` / `GET /api/rentals/me` reales. |
| 5  | Verificar código de estado, cuerpo, y el conteo real en `Rental` vía Prisma. |
| 6  | Borrar en `afterEach` el usuario, su suscripción/arriendos y el `Book` de prueba. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
Usuario con suscripción `mensual` activa real arrienda un `Book` de pago real → `201`. `GET /api/rentals/me` → `200`, un solo arriendo, con `book.title` igual al del fixture creado.

#### Escenario 2: Caso inválido
Usuario sin ninguna suscripción persistida intenta arrendar → `403 No tienes una suscripción activa`; se confirma contra Postgres que no se creó ninguna fila en `Rental`.

#### Escenario 3: Campos vacíos
`POST /api/rentals` con body `{}` → `422`, `errors` incluye `bookId`.

#### Escenario 4: Regla de negocio sobre datos reales
Arrendar dos veces el mismo libro con la misma suscripción activa → la segunda llamada reutiliza la fila existente; se confirma con `prisma.rental.count` que sigue existiendo exactamente 1 fila para ese usuario/libro.

---

### Resultado obtenido

✅ **PASS** — 4/4 tests de `rentals.integration.test.js` pasaron en `npx vitest run tests/integration`. Datos de prueba (usuario, suscripción, arriendos y `Book` fixture) eliminados en `afterEach`.
