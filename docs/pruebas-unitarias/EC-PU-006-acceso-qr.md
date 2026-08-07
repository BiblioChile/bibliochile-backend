### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-006
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                              |
|------------|--------------------------------------------|
| EC-CU-006  | Acceder a un libro por QR sin registro previo |

**Archivo bajo prueba:** `src/services/qr.service.js` (función `getQRByCode`)
**Archivo de test:** `tests/unit/qr.service.test.js`
**Schema de validación:** no aplica — `code` es un parámetro de ruta (`GET /api/qr/:code`), sin schema Zod

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Acceso por QR sin registro previo**, comprobando que el sistema:

- Devuelva los datos del QR y su libro asociado cuando el código existe y está activo.
- Rechace el acceso cuando el código no existe o cuando el QR fue desactivado.
- No falle de forma distinta ante un código vacío — se trata como "no encontrado".

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `getQRByCode(code)` con el dato del escenario. |
| 2  | Mockear `prisma.qRCode.findUnique` con el resultado simulado. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar que `findUnique` fue invocado con el `code` correcto. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo | Dato                  |
|-------|------------------------|
| code  | EST-BAQUEDANO-01        |

**Salida esperada**
- Se devuelve el registro del QR (`gutendex_id`, `location_name`, `is_active: true`).
- No se lanza ninguna excepción.

#### Escenario 2: Caso inválido

| Campo | Dato                   |
|-------|-------------------------|
| code  | CODIGO-INEXISTENTE       |

**Salida esperada**
- Se lanza el error `"QR no encontrado"` (`prisma.qRCode.findUnique` devuelve `null`).

Variante 2b: código existente pero con `is_active: false` → se lanza `"QR inactivo"`.

#### Escenario 3: Campos vacíos

| Campo | Dato     |
|-------|----------|
| code  | (vacío)  |

**Salida esperada**
- `getQRByCode("")` no encuentra coincidencia en la base y rechaza con `"QR no encontrado"`.
- No aplica schema Zod: no hay validación de formato de `code`, cualquier string se consulta tal cual contra la base — el "vacío" se prueba directamente contra el servicio.

---

### Resultado obtenido

✅ **PASS** — los 4 tests del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-07.
