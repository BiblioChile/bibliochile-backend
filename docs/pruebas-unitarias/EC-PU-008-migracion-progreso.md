### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-008
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                              |
|------------|------------------------------------------------------------|
| EC-CU-008  | Migrar progreso anónimo a la cuenta autenticada (HU-10)   |

**Archivo bajo prueba:** `src/services/progress.service.js` (función `syncProgress`)
**Archivo de test:** `tests/unit/progress.service.test.js`
**Schema de validación:** `src/schemas/progress.schema.js` (`syncSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Migrar progreso anónimo a la cuenta**, comprobando que el sistema:

- Reasigne al `userId` autenticado todos los registros de `readingProgress` que estaban asociados al `anonymousUuid` de la sesión anónima, y limpie el `anonymous_uuid` de esos registros.
- Devuelva la cantidad de registros migrados (`synced`).
- No capture ni transforme errores de Prisma: `syncProgress` no tiene bloque `try/catch` (a diferencia de `saveProgress`), por lo que cualquier error de la base de datos se propaga tal cual hacia quien la invoque (el controlador `syncReadingProgress`, que responde 500 genérico).
- Valide que `anonymousUuid` sea un UUID obligatorio antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `syncProgress(userId, anonymousUuid)`. |
| 2  | Mockear `prisma.readingProgress.updateMany` según el escenario. |
| 3  | Verificar el resultado devuelto o el error propagado. |
| 4  | Confirmar que el `where` del `updateMany` filtre por `anonymous_uuid` y que el `data` actualice `user_id` y limpie `anonymous_uuid` a `null`. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo               | Dato          |
|----------------------|---------------|
| userId               | 7             |
| anonymousUuid        | "uuid-anon-1" |
| updateMany.count     | 2             |

**Salida esperada**
- Se invoca `prisma.readingProgress.updateMany` con `where: { anonymous_uuid: "uuid-anon-1" }` y `data: { user_id: 7, anonymous_uuid: null }`.
- El servicio devuelve `{ synced: 2 }`.

#### Escenario 2: Caso inválido

| Campo               | Dato          |
|----------------------|---------------|
| userId               | 7             |
| anonymousUuid        | "uuid-anon-1" |
| updateMany           | rechaza con `Error("DB connection error")` |

**Salida esperada**
- El error de Prisma se propaga sin modificar (`rejects.toThrow("DB connection error")`), ya que `syncProgress` no tiene manejo de errores propio.
- Esto es una diferencia de diseño respecto a `saveProgress`, que sí normaliza sus errores; queda registrado como comportamiento real, no como defecto a corregir en este EC.

#### Escenario 3: Campos vacíos

| Campo               | Dato      |
|----------------------|-----------|
| anonymousUuid        | (ausente) |

**Salida esperada**
- `syncSchema.safeParse({})` retorna `success: false`.
- Los errores incluyen el campo `anonymousUuid`.
- Esta validación ocurre en la capa de middleware (`validate(syncSchema)`, ruta `POST /sync`), antes de llegar al servicio.

---

### Resultado obtenido

✅ **PASS** — los 3 tests de `syncProgress` pasaron en la ejecución de `npx vitest run tests/unit/progress.service.test.js` del 2026-08-12, 18:21 hrs (12/12 tests del archivo completo, incluyendo `saveProgress` y `getProgress`).
