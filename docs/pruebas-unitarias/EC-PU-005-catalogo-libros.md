### PRUEBA UNITARIA: BiblioChile — Backend

### CÓDIGO EC: EC-PU-005
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                                      |
|------------|---------------------------------------------------|
| EC-CU-005  | Explorar catálogo de libros y lector integrado    |

**Archivo bajo prueba:** `src/services/book.service.js` (funciones `getBooks`, `getBookById`)
**Archivo de test:** `tests/unit/book.service.test.js`
**Schema de validación:** no aplica — `search`, `genre` y `page` son query params opcionales, sin schema Zod en la ruta (`GET /api/books`)

---

### Objetivo general de la prueba

Verificar la lógica del caso de uso **Explorar catálogo**, comprobando que el sistema:

- Consulte la API de Gutendex y devuelva los libros mapeados al formato interno.
- Rechace la búsqueda cuando Gutendex no responde correctamente (`getBooks`) o el libro no existe (`getBookById`).
- Funcione sin filtros, usando solo los parámetros por defecto (`languages=es`, `page=1`).

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Invocar `getBooks({ search, genre, page })` o `getBookById(id)` según el escenario. |
| 2  | Mockear `fetch` (paquete `node-fetch`) con la respuesta simulada de Gutendex. |
| 3  | Verificar el resultado mapeado o el error lanzado. |
| 4  | Confirmar la URL con la que se invocó `fetch` (filtros aplicados o ausentes). |
| 5  | Registrar el resultado obtenido y compararlo con el resultado esperado. |

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso

| Campo  | Dato              |
|--------|-------------------|
| search | "martin rivas"    |
| page   | 1                 |

**Salida esperada**
- `fetch` es invocado con `search=martin+rivas` en la URL.
- Se devuelve `{ count, next, previous, results }` con cada libro mapeado (`id`, `title`, `author`, `description`, `cover_url`, `content_url`, `is_free`).
- No se lanza ninguna excepción.

#### Escenario 2: Caso inválido

| Campo | Dato                          |
|-------|--------------------------------|
| id    | 999999 (no existe en Gutendex) |

**Salida esperada**
- `getBookById` lanza el error `"Libro no encontrado"` cuando la respuesta de Gutendex no es `ok`.

Variante 2b: `getBooks` con la API de Gutendex no disponible (`response.ok === false`) → lanza `"Error al conectar con Gutendex"`.

#### Escenario 3: Campos vacíos

| Campo  | Dato      |
|--------|-----------|
| search | (ausente) |
| genre  | (ausente) |
| page   | (default) |

**Salida esperada**
- `getBooks({})` no lanza error — usa solo `languages=es&page=1` en la URL.
- La URL no contiene `search=` ni `topic=`.
- No aplica un schema Zod porque los filtros son opcionales por naturaleza: no hay un "campo obligatorio vacío" que rechazar, se prueba que el servicio tolera la ausencia de filtros.

---

### Resultado obtenido

✅ **PASS** — los 4 tests del archivo (incluida la variante 2b) pasaron en la ejecución de `npx vitest run` del 2026-08-07.
