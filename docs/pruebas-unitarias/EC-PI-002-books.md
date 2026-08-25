### PRUEBA DE INTEGRACIÓN: BiblioChile — Backend

### CÓDIGO EC: EC-PI-002
### Caso de uso / Historia de usuario a probar

| Código EC  | Caso de Uso                          |
|------------|----------------------------------------|
| EC-CU-005  | Explorar catálogo de libros (HU-04)    |

**Rutas bajo prueba:** `GET /api/books`, `GET /api/books/:id` (`src/routes/book.routes.js`)
**Archivo de test:** `tests/integration/books.integration.test.js`
**Base de datos:** ninguna — `book.service.js` no toca Postgres, sirve el catálogo en vivo desde Gutendex
**Referencia unitaria relacionada:** `EC-PU-005` (con `node-fetch` mockeado)

---

### Objetivo general de la prueba

`book.service.js` es el único módulo del backend sin persistencia local, así que esta prueba no verifica escritura en Postgres como el resto de `EC-PI-*` — verifica:

- Que la ruta HTTP real, sin mockear `node-fetch`, golpee la API real de Gutendex y devuelva el catálogo con la forma que el frontend espera.
- Que un id inexistente en Gutendex real (no simulado con `{ ok: false }`) resulte en el mismo `404` que el test unitario verifica de forma aislada.
- Que `optionalAuth` realmente no bloquee la ruta pública cuando el token es inválido — comportamiento de middleware que solo se observa con la app completa montada.

---

### Pasos de la prueba

| ID | Descripción |
|----|-------------|
| 1  | Enviar la petición HTTP real con `supertest(app)`, sin mockear `fetch`. |
| 2  | Esperar la respuesta real de `gutendex.com`. |
| 3  | Verificar el código de estado y la forma del cuerpo de la respuesta. |

No requiere limpieza de datos — no se persiste nada.

---

### Evaluación de escenarios

#### Escenario 1: Mejor caso
`GET /api/books?page=1` → `200`, `count` numérico, `results` es un array; si trae resultados, cada uno tiene `id` e `is_free: true`.

#### Escenario 2: Caso inválido
`GET /api/books/999999999` (id que no existe en Gutendex) → `404 Libro no encontrado`, obtenido de una respuesta real de la API, no de un mock `{ ok: false }`.

#### Escenario 3: Middleware transversal
`GET /api/books/55465` con `Authorization: Bearer token-invalido-que-no-deberia-bloquear` → `200` — `optionalAuth` descarta el token inválido y sigue como anónimo, sin bloquear la ruta pública.

---

### Resultado obtenido

✅ **PASS** — 3/3 tests de `books.integration.test.js` pasaron en `npx vitest run tests/integration`, contra la API real de Gutendex.

**Nota:** esta suite depende de que `gutendex.com` esté disponible al momento de correr los tests — es la única excepción a "todo contra Postgres local" del resto de `EC-PI-*`, porque no existe una capa de persistencia local que probar en este módulo.
