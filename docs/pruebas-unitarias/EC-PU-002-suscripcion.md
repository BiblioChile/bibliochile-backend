### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-002
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                          |
|------------|---------------------------------------|
| EC-CU-002  | Suscribirse a un plan (mensual/anual) |

**Archivo bajo prueba:** `src/services/subscription.service.js` (función `createSubscription`)
**Archivo de test:** `tests/unit/subscription.service.test.js`
**Schema de validación:** `src/schemas/subscription.schema.js` (`subscriptionSchema`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Suscribirse a un plan**, comprobando que el sistema:

- Cree la suscripción cuando el usuario no tiene una activa y el plan existe.
- Impida suscripciones duplicadas si ya existe una suscripción activa.
- Rechace planes inexistentes.
- Valide que `planId` sea obligatorio antes de llegar a la lógica de negocio.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `createSubscription(userId, planId)` con los datos del escenario. |
| 2  | Mockear `prisma.subscription.findFirst`, `prisma.subscriptionPlan.findUnique` y `prisma.subscription.create` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar si la suscripción fue creada o rechazada. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo                        | Dato               |
|-------------------------------|---------------------|
| userId                        | 1                   |
| planId                        | 1 (plan "mensual" existente) |
| Suscripción activa previa     | No existe           |

**Salida esperada**
- Se crea la suscripción con `status: "activa"`.
- `prisma.subscription.create` es invocado exactamente una vez.

#### Escenario 2: Caso inválido

| Campo                     | Dato                          |
|----------------------------|--------------------------------|
| userId                     | 1                              |
| planId                     | 1                               |
| Suscripción activa previa  | Sí existe (`status: "activa"`) |

**Salida esperada**
- Se lanza el error `"Ya tienes una suscripción activa"` (HTTP 409 en el controller).
- `prisma.subscription.create` no es invocado.

Variante 2b: `planId` que no existe en `SubscriptionPlan` → error `"Plan no encontrado"` (HTTP 404 en el controller).

#### Escenario 3: Campos vacíos

| Campo   | Dato     |
|---------|----------|
| planId  | (ausente) |

**Salida esperada**
- `subscriptionSchema.safeParse({})` retorna `success: false`.
- El error apunta al campo `planId`.
- Esta validación ocurre en la capa de middleware (`validate(subscriptionSchema)`), antes de llegar al servicio.

---

### Resultado obtenido

✅ **PASS** — los 4 tests del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-05.
