### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-004
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                    |
|------------|--------------------------------------------------|
| EC-CU-004  | Arrendar un libro bajo la suscripción activa     |

**Archivo bajo prueba:** `src/services/rental.service.js` (función `createRental`) — módulo nuevo de este sprint
**Archivo de test:** `tests/unit/rental.service.test.js`
**Schema de validación:** `src/schemas/rental.schema.js` (`rentalSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Arrendar un libro**, comprobando que el sistema:

- Cree el arriendo cuando el usuario tiene una suscripción activa, el libro existe y no ha superado el cupo del plan (`max_rentals`).
- Rechace el arriendo si el usuario no tiene una suscripción activa.
- Rechace el arriendo si ya alcanzó el límite de arriendos de su plan.
- Valide que `bookId` sea obligatorio antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `createRental(userId, bookId)` con los datos del escenario. |
| 2  | Mockear `prisma.subscription.findFirst`, `prisma.book.findUnique`, `prisma.rental.findFirst` y `prisma.rental.create` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar si el arriendo fue creado o rechazado. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo                          | Dato                         |
|----------------------------------|-------------------------------|
| userId                           | 7                              |
| bookId                           | 123 (libro existente)          |
| Suscripción activa                | Sí, con 1/5 arriendos usados   |
| Arriendo previo del mismo libro   | No existe                      |

**Salida esperada**
- Se crea el arriendo (`prisma.rental.create` invocado una vez).
- `expires_at` del arriendo se fija igual a `end_date` de la suscripción.

#### Escenario 2: Caso inválido

| Campo               | Dato       |
|-----------------------|------------|
| userId                 | 7          |
| bookId                 | 123        |
| Suscripción activa     | No existe  |

**Salida esperada**
- Se lanza el error `"No tienes una suscripción activa"` (HTTP 403 en el controller).
- `prisma.rental.create` no es invocado.

Variante 2b: suscripción activa pero con `rentals_used == max_rentals` (5/5) → error `"Has alcanzado el límite de arriendos de tu plan"` (HTTP 409 en el controller).

#### Escenario 3: Campos vacíos

| Campo   | Dato      |
|---------|-----------|
| bookId  | (ausente) |

**Salida esperada**
- `rentalSchema.safeParse({})` retorna `success: false`.
- El error apunta al campo `bookId`.
- Esta validación ocurre en la capa de middleware (`validate(rentalSchema)`), antes de llegar al servicio.

---

### Resultado obtenido

✅ **PASS** — los 4 tests del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-05.
