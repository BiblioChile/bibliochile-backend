### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-007
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                                        |
|------------|----------------------------------------------------------------------|
| EC-CU-007  | Proteger endpoints (autenticación, validación de entrada y roles) |

**Archivos bajo prueba:**
- `src/middlewares/auth.middleware.js` (`verifyToken`, `optionalAuth`)
- `src/middlewares/validation.middleware.js` (`validate`)
- `src/middlewares/role.middleware.js` (`requireRole`)

**Archivo de test:** `tests/unit/middlewares.test.js`

---

### Objetivo general de la prueba

Verificar la capa transversal que protege todos los módulos (1, 2 y 3), comprobando que el sistema:

- Bloquee el acceso a rutas protegidas sin un JWT válido (`verifyToken`), y que las rutas de acceso opcional (`optionalAuth`) degraden a anónimo en vez de rechazar.
- Rechace el body de una request cuando no cumple el schema Zod correspondiente (`validate`), devolviendo el detalle de los campos con error.
- Restrinja acciones por rol de usuario (`requireRole`), distinguiendo "no autenticado" (401) de "sin permiso" (403).

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Construir un `req` simulado (headers / body / user) y un `res` con `status`/`json` espiados (`vi.fn`). |
| 2  | Invocar el middleware con `(req, res, next)`. |
| 3  | Mockear `jwt.verify` según el escenario (token válido / inválido). |
| 4  | Verificar si `next()` fue llamado, y si `res.status`/`res.json` responden con el código y mensaje esperado. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Middleware   | Entrada                                            |
|--------------|-----------------------------------------------------|
| verifyToken  | Header `Authorization: Bearer <token válido>`      |
| optionalAuth | Header `Authorization: Bearer <token válido>`      |
| validate     | Body que cumple el schema Zod                       |
| requireRole  | `req.user.role` incluido en los roles permitidos    |

**Salida esperada**
- `verifyToken`/`optionalAuth`: `req.user` queda con el payload decodificado y se llama `next()`.
- `validate`: `req.body` se reemplaza por los datos parseados y se llama `next()`.
- `requireRole`: se llama `next()` sin tocar `res`.

#### Escenario 2: Caso inválido

| Middleware   | Entrada                                    |
|--------------|----------------------------------------------|
| verifyToken  | Header con token inválido/expirado            |
| optionalAuth | Header con token inválido/expirado            |
| validate     | Body con un campo de tipo incorrecto          |
| requireRole  | `req.user.role` no está en los roles permitidos |

**Salida esperada**
- `verifyToken`: responde `401` con `"Token inválido o expirado"`, no llama `next()`.
- `optionalAuth`: **no** rechaza — continúa como anónimo (`req.user` queda `undefined`), llama `next()`. Es la diferencia de diseño clave frente a `verifyToken`.
- `validate`: responde `422` con el detalle del error, no llama `next()`.
- `requireRole`: responde `403` con `"No tienes permiso para esta acción"`, no llama `next()`.

#### Escenario 3: Campos vacíos

| Middleware   | Entrada                          |
|--------------|-------------------------------------|
| verifyToken  | Sin header `Authorization`          |
| optionalAuth | Sin header `Authorization`          |
| validate     | Body vacío (`{}`)                    |
| requireRole  | `req.user` ausente (sin autenticar) |

**Salida esperada**
- `verifyToken`: responde `401` con `"Token no proporcionado"`, no llama `next()`.
- `optionalAuth`: continúa como anónimo, llama `next()`.
- `validate`: responde `422` listando todos los campos obligatorios faltantes.
- `requireRole`: responde `401` con `"No autenticado"` (se evalúa antes que el rol).

---

### Resultado obtenido

✅ **PASS** — los 12 tests del archivo pasaron en la ejecución de `npx vitest run` del 2026-08-07.
