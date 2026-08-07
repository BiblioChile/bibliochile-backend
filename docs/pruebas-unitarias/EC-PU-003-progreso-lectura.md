### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-003
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                              |
|------------|--------------------------------------------|
| EC-CU-003  | Guardar progreso de lectura de un libro    |

**Archivo bajo prueba:** `src/services/progress.service.js` (función `saveProgress`)
**Archivo de test:** `tests/unit/progress.service.test.js`
**Schema de validación:** `src/schemas/progress.schema.js` (`progressSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Guardar progreso de lectura**, comprobando que el sistema:

- Guarde (cree o actualice) el progreso cuando viene identificado por `userId` o `anonymousUuid`.
- Rechace el guardado si no viene ninguno de los dos identificadores.
- Valide que `bookId` y `progressPercentage` sean obligatorios antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `saveProgress({ userId, anonymousUuid, bookId, progressPercentage, lastPosition })`. |
| 2  | Mockear `prisma.readingProgress.upsert` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar que el `where` del upsert use la llave compuesta correcta (`user_id_book_id` o `anonymous_uuid_book_id`). |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo               | Dato       |
|----------------------|------------|
| userId               | 7          |
| anonymousUuid        | null       |
| bookId               | 123        |
| progressPercentage   | 42         |
| lastPosition         | "42%"      |

**Salida esperada**
- Se invoca `prisma.readingProgress.upsert` con `where: { user_id_book_id: { user_id: 7, book_id: 123 } }`.
- El `update` incluye `progress_percentage: 42` y `updated_at` (fecha vigente).
- El progreso se devuelve correctamente.

#### Escenario 2: Caso inválido

| Campo               | Dato       |
|----------------------|------------|
| userId               | null       |
| anonymousUuid        | null       |
| bookId               | 123        |
| progressPercentage   | 50         |

**Salida esperada**
- Se lanza el error `"Se requiere user_id o anonymous_uuid"`.
- `prisma.readingProgress.upsert` no es invocado.

#### Escenario 3: Campos vacíos

| Campo               | Dato      |
|----------------------|-----------|
| bookId               | (ausente) |
| progressPercentage   | (ausente) |

**Salida esperada**
- `progressSchema.safeParse({})` retorna `success: false`.
- Los errores incluyen los campos `bookId` y `progressPercentage`.
- Esta validación ocurre en la capa de middleware (`validate(progressSchema)`), antes de llegar al servicio.

---

### Resultado obtenido

✅ **PASS** — los 3 tests del archivo pasaron en la ejecución de `npx vitest run` del 2026-08-05.

**Nota:** esta prueba también sirve como regresión del bugfix aplicado en `saveProgress` (campo `update_at` mal escrito y `Date()` sin `new` — ver `DECISIONS.md`), ya que el `expect` del Escenario 1 verifica explícitamente el contenido del `update` enviado a Prisma.
