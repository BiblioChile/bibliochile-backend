### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-010
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                                          |
|------------|------------------------------------------------------------------------|
| EC-CU-010  | Administración: catálogo gestionable, QR y decisiones de autor (HU-08, HU-09) |

**Archivo bajo prueba:** `src/services/admin.service.js` (funciones `listManagedBooks`, `createQRCode`, `listQRCodes`, `toggleQRCode`, `listPendingAuthors`, `approveAuthor`, `rejectAuthor`) — módulo nuevo de este sprint
**Archivo de test:** `tests/unit/admin.service.test.js`
**Schema de validación:** `src/schemas/admin.schema.js` (`createQRCodeSchema`, `rejectAuthorSchema`)
**Control de acceso por rol:** `requireRole('admin')` en todas las rutas — ya probado a nivel de middleware en `EC-PU-007` (Escenario 2: rol no permitido → 403); no se duplica acá, se reutiliza y se confirma también con prueba manual (ver más abajo).

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Administración**, comprobando que el sistema:

- Liste solo los `Book` que existen localmente (autores nacionales vía `author_id`, gratuitos ya sincronizados vía `gutendex_id`) — nunca el catálogo completo de Gutendex, que no se persiste.
- Genere QR codes con un `code` correlativo (`BCH-00N`), validando primero que el `gutendex_id` exista realmente en Gutendex antes de crearlo.
- Permita activar/desactivar un QR existente, y rechace la operación si el QR no existe.
- Liste autores en estado `"pendiente"` con sus datos completos para revisión.
- Apruebe un autor (limpiando cualquier `rejection_reason`/`rejection_note` previo, por si fue rechazado antes) o lo rechace con un `reason` del enum `RejectionReason` (`problema_sistema` | `otro`), guardando `rejection_note` solo cuando `reason === "otro"`.
- Rechace cualquiera de las operaciones sobre un autor/QR inexistente con un mensaje de error específico, sin tocar la base de datos.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar la función bajo prueba con los datos del escenario. |
| 2  | Mockear `prisma.book.findMany`, `prisma.qRCode.*`, `prisma.author.*` y `book.service.getBookById` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar los datos exactos enviados a Prisma (`where`/`data`) cuando aplica. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### `listManagedBooks` — Escenario 1: Mejor caso

**Salida esperada**
- Se invoca `prisma.book.findMany` con `where: { OR: [{ author_id: { not: null } }, { gutendex_id: { not: null } }] }`.
- Devuelve los libros de autores nacionales y los gratuitos ya sincronizados, tal cual los retorna Prisma.

#### `listManagedBooks` — Escenario 2: Caso inválido
- Error de Prisma en `findMany` se propaga sin ser capturado.

#### `listManagedBooks` — Escenario 3: Campos vacíos
- Sin libros gestionables localmente, devuelve `[]`.

---

#### `createQRCode` — Escenario 1: Mejor caso

| Campo         | Dato                        |
|-----------------|-------------------------------|
| locationName    | "Estación Los Héroes"         |
| gutendexId      | 55465 (existe en Gutendex)    |
| createdBy       | 1                              |

**Salida esperada**
- Se valida primero contra Gutendex vía `getBookById(gutendexId)` (reutilizando `book.service.js`).
- Se genera un `code` correlativo (`BCH-004`, con 3 QR ya creados) y se crea el `QRCode` vía `prisma.qRCode.create`.

#### `createQRCode` — Escenario 2: Caso inválido
- `gutendexId` inexistente en Gutendex (`getBookById` rechaza) → se lanza `"El libro de Gutendex no existe"` (HTTP 404 en el controller); `prisma.qRCode.create` no se invoca.

Variante 2b: error de Prisma al crear (con Gutendex validado OK) se propaga sin ser capturado.

#### `createQRCode` — Escenario 3: Campos vacíos
- Sin QR previos (`count: 0`), el primer código generado es `BCH-001`.

---

#### `listQRCodes` — Escenario 1 (mejor caso), 2 (caso inválido), 3 (campos vacíos)
- Devuelve los QR ordenados por `created_at: "desc"`; propaga error de Prisma; devuelve `[]` sin QR creados.

#### `toggleQRCode` — Escenario 1: Mejor caso
- QR activo (`is_active: true`) se desactiva vía `prisma.qRCode.update({ data: { is_active: false } })`.

#### `toggleQRCode` — Escenario 2: Caso inválido
- QR inexistente rechaza con `"QR no encontrado"`; `prisma.qRCode.update` no se invoca.

#### `toggleQRCode` — Escenario 3: Campos vacíos
- QR inactivo se reactiva (`is_active: false → true`).

---

#### `listPendingAuthors` — Escenario 1 (mejor caso), 2 (caso inválido), 3 (campos vacíos)
- Devuelve autores con `status: "pendiente"` incluyendo `user: { name, email }`; propaga error de Prisma; devuelve `[]` sin pendientes.

#### `approveAuthor` — Escenario 1: Mejor caso
- Autor pendiente se actualiza a `status: "aprobado"`, limpiando `rejection_reason` y `rejection_note` a `null`,
  **y además** actualiza `User.role` a `"autor"` (vía `author.user_id`), en la misma
  `prisma.$transaction([author.update, user.update])`. Este segundo update es el fix de un bug
  real encontrado el 2026-08-25: las rutas de autor están gateadas por `requireRole('autor')`,
  que lee `role` del `User`, no el `status` del `Author` — sin este update, un autor aprobado
  quedaba con `role: "pasajero"` para siempre y nunca podía usar `POST /authors/books` ni
  `GET /authors/me/stats`.

#### `approveAuthor` — Escenario 2: Caso inválido
- Autor inexistente rechaza con `"Autor no encontrado"`; ni `prisma.author.update` ni
  `prisma.user.update` se invocan, y no se abre transacción.

#### `approveAuthor` — Escenario 3: Campos vacíos
- Un autor previamente rechazado también puede re-aprobarse (no hay restricción de estado previo),
  y también le actualiza el `role` a `"autor"`.

#### `rejectAuthor` — sin cambios en `User.role`
- A diferencia de `approveAuthor`, `rejectAuthor` **no** toca `User.role` — un rechazo no debe
  promover a nadie. El usuario rechazado se queda con el `role` que ya tenía (`"pasajero"` en el
  flujo esperado). Confirmado explícitamente, no solo por omisión: ver comentario en
  `admin.service.js` junto a `rejectAuthor`.

---

#### `rejectAuthor` — Escenario 1: Mejor caso

| Campo    | Dato                |
|------------|-----------------------|
| authorId    | 1                     |
| reason      | "problema_sistema"    |
| note        | (ausente)             |

**Salida esperada**
- `status: "rechazado"`, `rejection_reason: "problema_sistema"`, `rejection_note: null` (solo se guarda cuando `reason === "otro"`).

#### `rejectAuthor` — Escenario 2: Caso inválido
- Autor inexistente rechaza con `"Autor no encontrado"`; `prisma.author.update` no se invoca.

#### `rejectAuthor` — Escenario 3: Campos vacíos
- `reason: "otro"` sin `note` guarda `rejection_note: null`.

Variante 3b: `reason: "otro"` con `note` guarda el texto tal cual (`rejection_note: "Documentación incompleta"`).

---

### Endpoints y verificación funcional (manual, sobre la BD local de Docker)

1. `POST /api/admin/qrcodes` con usuario admin y `gutendexId` válido → `201`, `code: "BCH-00N"`.
2. `POST /api/admin/qrcodes` con `gutendexId` inexistente en Gutendex → `404 El libro de Gutendex no existe`.
3. `GET /api/admin/authors/pending` → `200`, lista de autores pendientes con RUT/bio/fecha.
4. `PATCH /api/admin/authors/:id/approve` → `200`, `status: "aprobado"`.
5. `PATCH /api/admin/authors/:id/reject` con `reason: "otro"`, `note` → `200`, `rejection_reason`/`rejection_note` guardados.
6. Las mismas rutas con un usuario `"pasajero"` (sin rol admin) → `403 No tienes permiso para esta acción` en todas — confirma que `role.middleware.js` queda correctamente conectado por primera vez a rutas reales.

Datos de prueba eliminados de la BD local al finalizar.

---

### Resultado obtenido

✅ **PASS** — los 22 tests de `admin.service.test.js` pasaron en la ejecución de `npx vitest run`
del 2026-08-21 (81/81 tests del backend completo, 9 archivos). Verificación funcional manual (paso
a paso arriba) también exitosa contra la BD local, incluyendo el 403 explícito sin rol admin.

**Actualización 2026-08-25 — fix de `approveAuthor` (`User.role` no se actualizaba):**
23 tests de `admin.service.test.js` en verde (el fix agregó verificación explícita de
`prisma.user.update` en los 3 escenarios de `approveAuthor`, sin agregar un test nuevo). Suite
completa del backend: 111/111 tests, 17 archivos. Verificación manual repetida contra la BD local
real (registro pasajero → declara autor → `403` en ruta de autor con el token viejo → admin
aprueba → `role` ya es `"autor"` en la BD, pero el mismo token viejo sigue en `403` porque el JWT
no se actualiza solo → re-login con JWT fresco → `200` en `GET /api/authors/me/stats`). Datos de
prueba eliminados al finalizar.

**Nota:** la mejora UX opcional (validar `gutendexId` contra Gutendex antes de crear el QR,
reutilizando `book.service.getBookById`) sí se implementó — ver escenarios 1 y 2 de `createQRCode`
arriba. La generación de imagen PNG/SVG descargable del QR quedó fuera de alcance de este sprint,
por decisión explícita.
