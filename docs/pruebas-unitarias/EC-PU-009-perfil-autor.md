### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-009
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                                        |
|------------|----------------------------------------------------------------------|
| EC-CU-009  | Perfil de autor: registro, subida de obra y estadísticas (HU-05, HU-06, HU-07) |

**Archivo bajo prueba:** `src/services/author.service.js` (funciones `registerAuthor`, `getAuthorByUserId`, `uploadBook`, `getMyStats`) — módulo nuevo de este sprint
**Archivo de test:** `tests/unit/author.service.test.js`
**Schema de validación:** `src/schemas/author.schema.js` (`registerAuthorSchema`, `uploadBookSchema`, `isValidRut`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Perfil de autor**, comprobando que el sistema:

- Registre un `Author` en estado `"pendiente"` cuando el usuario acepta la declaración jurada y no tiene ya un registro (por `user_id` o por `rut`).
- Rechace el registro si no se acepta la declaración jurada, o si el usuario/RUT ya está registrado.
- Valide el formato y dígito verificador de un RUT chileno (con y sin puntos) antes de llegar al servicio.
- Permita subir una obra (`Book`, `is_free: false`) solo si el autor está `"aprobado"`, y la rechace en cualquier otro estado (`"pendiente"`, `"rechazado"`).
- Calcule estadísticas (`totalBooks`, `totalReaders`, `avgProgressPercentage`, `totalRentals`) sobre las obras del autor, contando lectores únicos (por `user_id` o `anonymous_uuid`) y devolviendo ceros cuando el autor no tiene obras publicadas.
- Resuelva el `Author` asociado a un `userId` autenticado (`getAuthorByUserId`), usado por el controller para traducir el `userId` del token al `authorId` interno antes de llamar a `uploadBook`/`getMyStats`.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar la función bajo prueba con los datos del escenario. |
| 2  | Mockear `prisma.author.findUnique/create`, `prisma.book.create/findMany`, `prisma.readingProgress.findMany` y `prisma.rental.count` según el escenario. |
| 3  | Verificar el resultado devuelto o el error lanzado. |
| 4  | Confirmar los datos exactos enviados a Prisma (`where`/`data`) cuando aplica. |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### `registerAuthor` — Escenario 1: Mejor caso

| Campo                | Dato                    |
|------------------------|--------------------------|
| userId                  | 7                        |
| rut                     | "12345678-5" (válido)    |
| bio                     | "Escritor chileno"       |
| declarationAccepted     | true                     |

**Salida esperada**
- Se crea el `Author` vía `prisma.author.create` con `status: "pendiente"` y `declaration_accepted: true`.
- El registro se devuelve correctamente.

#### `registerAuthor` — Escenario 2: Caso inválido

| Campo                | Dato          |
|------------------------|---------------|
| declarationAccepted     | false         |

**Salida esperada**
- Se lanza el error `"Debes aceptar la declaración jurada"` (HTTP 422 en el controller).
- `prisma.author.create` no es invocado.

Variante 2b: `userId` que ya tiene un `Author` registrado → error `"Ya tienes un registro de autor"` (HTTP 409 en el controller).

#### `registerAuthor` — Escenario 3: Campos vacíos

| Campo                | Dato      |
|------------------------|-----------|
| rut                     | (ausente) |
| declarationAccepted     | (ausente) |

**Salida esperada**
- `registerAuthorSchema.safeParse({})` retorna `success: false`.
- Los errores incluyen los campos `rut` y `declarationAccepted`.
- Esta validación ocurre en la capa de middleware (`validate(registerAuthorSchema)`), antes de llegar al servicio.

#### `isValidRut` — validación de formato y dígito verificador

- `"12345678-5"` y `"12.345.678-5"` (mismo RUT, con y sin puntos) → válidos.
- `"12345678-9"` (dígito verificador incorrecto para ese cuerpo) → inválido.

#### `uploadBook` — Escenario 1: Mejor caso

| Campo               | Dato                                                |
|-----------------------|--------------------------------------------------------|
| authorId               | 1 (`status: "aprobado"`)                               |
| title                  | "Mi novela"                                             |
| contentUrl             | "https://bibliochile.cl/books/mi-novela.html"           |

**Salida esperada**
- Se crea el `Book` vía `prisma.book.create` con `author_id: 1`, `is_free: false` y los datos enviados.
- El libro creado se devuelve correctamente.

#### `uploadBook` — Escenario 2: Caso inválido

| Campo               | Dato          |
|-----------------------|---------------|
| authorId               | 1 (`status: "pendiente"`) |

**Salida esperada**
- Se lanza el error `"Tu cuenta de autor aún no ha sido aprobada"` (HTTP 403 en el controller).
- `prisma.book.create` no es invocado.

#### `uploadBook` — Escenario 3: Campos vacíos

| Campo       | Dato      |
|---------------|-----------|
| title          | (ausente) |
| contentUrl     | (ausente) |

**Salida esperada**
- `uploadBookSchema.safeParse({})` retorna `success: false`.
- Los errores incluyen los campos `title` y `contentUrl`.
- Esta validación ocurre en la capa de middleware (`validate(uploadBookSchema)`), antes de llegar al servicio.

#### `getMyStats` — Escenario 1: Mejor caso

| Campo                          | Dato                                                          |
|----------------------------------|------------------------------------------------------------------|
| authorId                         | 1, con 2 libros publicados                                       |
| Registros de `ReadingProgress`   | 3 (2 del mismo `user_id`, 1 de un `anonymous_uuid` distinto)      |
| Arriendos (`rental.count`)       | 3                                                                 |

**Salida esperada**
- `totalBooks: 2`.
- `totalReaders: 2` (el `user_id` repetido se cuenta una sola vez — lector único).
- `avgProgressPercentage: 60` (promedio de `40, 60, 80`).
- `totalRentals: 3`.

#### `getMyStats` — Escenario 2: Caso inválido

| Campo       | Dato                          |
|---------------|--------------------------------|
| authorId       | 999 (no existe)                |

**Salida esperada**
- Se lanza el error `"Autor no encontrado"` (HTTP 404 en el controller).

#### `getMyStats` — Escenario 3: Campos vacíos

| Campo       | Dato                              |
|---------------|-------------------------------------|
| authorId       | 1, sin libros publicados (`[]`)     |

**Salida esperada**
- Retorna `{ totalBooks: 0, totalReaders: 0, avgProgressPercentage: 0, totalRentals: 0 }` sin consultar `readingProgress`/`rental` (cortocircuito cuando no hay libros).

#### `getAuthorByUserId` — Escenario 1 (mejor caso) y Escenario 2 (caso inválido)

- Usuario con `Author` registrado → retorna el `Author`.
- Usuario sin `Author` registrado → lanza `"No tienes un registro de autor"` (HTTP 404 en el controller, usado por `POST /api/authors/books` y `GET /api/authors/me/stats`).

---

### Endpoints y verificación funcional (manual, sobre la BD local de Docker)

Además de los tests unitarios, se verificó manualmente el flujo completo levantando el servidor
(`npm run dev`) contra la BD local:

1. `POST /api/auth/register` (role `"autor"`) → `POST /api/auth/login` → token JWT.
2. `POST /api/authors/register` con RUT válido → `201`, `status: "pendiente"`.
3. `POST /api/authors/books` con autor `"pendiente"` → `403 Tu cuenta de autor aún no ha sido aprobada`.
4. `GET /api/authors/me/stats` con autor `"pendiente"` (sin libros) → `200`, todo en cero.
5. Aprobación manual del autor (`status: "aprobado"`, simulando Módulo 5/Admin, aún no implementado).
6. `POST /api/authors/books` con autor `"aprobado"` → `201`, libro creado con `is_free: false`.
7. `GET /api/authors/me/stats` → `200`, `totalBooks: 1`.
8. Re-registro del mismo usuario → `409 Ya tienes un registro de autor`.
9. Registro con RUT de dígito verificador inválido (`"12345678-9"`) → `422` desde el middleware Zod.

Datos de prueba eliminados de la BD local al finalizar (usuario, autor y libro de la verificación).

---

### Resultado obtenido

✅ **PASS** — los 14 tests de `author.service.test.js` pasaron en la ejecución de `npx vitest run`
del 2026-08-21 (58/58 tests del backend completo, 8 archivos). Verificación funcional manual (paso
a paso arriba) también exitosa contra la BD local.
