### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-003
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                              |
|------------|---------------------------------------------|
| EC-CU-006  | Acceso por QR sin registro previo (HU-05)   |

**Ruta bajo prueba:** `GET /api/qr/:code` (`src/routes/qr.routes.js`)
**Archivo de test:** `tests/integration/qr.integration.test.js`
**Base de datos:** Postgres local de Docker — usa los QR sembrados por `prisma/seed.js` (`BCH-001` activo, `BCH-003` inactivo)
**Referencia unitaria relacionada:** `EC-PU-006` (con `prisma.qRCode.findUnique` mockeado)

---

### Objetivo general de la prueba

Verificar contra los datos reales sembrados en Postgres (no un mock de `findUnique`) que:

- Un QR activo existente resuelva al `gutendex_id` real guardado en la fila.
- Un código que no existe en la BD responda `404` con `redirect_to: "/catalog"`.
- Un QR que existe pero está desactivado (`is_active: false`, dato real persistido por el seed) sea rechazado igual que uno inexistente, confirmando que la regla de negocio se aplica sobre el dato real y no solo sobre el mock.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Confirmar que `prisma/seed.js` fue corrido contra la BD local antes de la suite (`BCH-001`, `BCH-002`, `BCH-003`). |
| 2  | Enviar la petición HTTP real con `supertest(app)`. |
| 3  | Verificar el código de estado y el cuerpo de la respuesta contra los valores reales sembrados. |

No requiere limpieza — solo lee datos ya sembrados, no crea nada.

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`GET /api/qr/BCH-001` → `200`, `gutendex_id: 2000`, `redirect_to: "/books/2000"` (valores reales del seed, no un mock).

#### Escenario 2: Caso inválido
`GET /api/qr/CODIGO-QUE-NO-EXISTE` → `404 QR no encontrado`, `redirect_to: "/catalog"`.

#### Escenario 3: Regla de negocio sobre dato real
`GET /api/qr/BCH-003` (sembrado con `is_active: false`) → `404 QR inactivo` — confirma que el filtro de estado activo se aplica sobre la fila real de Postgres.

---

### Resultado obtenido

✅ **PASS** — 3/3 tests de `qr.integration.test.js` pasaron en `npx vitest run tests/integration`, contra los QR reales sembrados en la BD local.
