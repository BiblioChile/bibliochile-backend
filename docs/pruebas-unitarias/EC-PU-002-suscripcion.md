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

---

## EC-PU-002c — Cambiar de plan (`changeSubscriptionPlan`)

**Archivo bajo prueba:** `src/services/subscription.service.js` (función `changeSubscriptionPlan`)
**Motivo:** hueco de producto detectado al investigar la regresión "suscripción duplicada" (`env/prompt_investigar_regresiones.md`) — no había forma de cambiar de plan (ej. mensual → anual) mientras la suscripción estuviera vigente, solo de crear una nueva o quedar bloqueado con 409.

### Objetivo

- Con una suscripción activa existente: cancelarla (`status: "cancelada"`) y crear la nueva con el plan pedido, sin prorrateo (se pierden los días restantes de la anterior, criterio explícito del prompt).
- Sin ninguna suscripción activa: comportarse igual que `createSubscription` (mismas validaciones, sin tocar `update`).
- Plan inexistente: rechazar antes de tocar cualquier suscripción existente.

### Evaluación de escenarios

| # | Escenario | Salida esperada |
|---|---|---|
| 1 | Mejor caso — suscripción activa (`plan_id: 1`) + `changeSubscriptionPlan(userId, 2)` | `changed: true`; `prisma.subscription.update` llamado con `{ status: "cancelada" }` sobre la anterior; `prisma.subscription.create` llamado una vez con el plan nuevo |
| 2 | Sin suscripción activa | `changed: false`; `prisma.subscription.update` **no** invocado; se crea la suscripción igual que `createSubscription` |
| 3 | Plan inexistente | Lanza `"Plan no encontrado"`; ni `findFirst` ni `update` se llegan a invocar (falla antes, igual que `createSubscription`) |

### Resultado obtenido

✅ **PASS** — 3/3 tests de `EC-PU-002c` (7/7 en el archivo completo) en `npx vitest run` del 2026-08-27.
