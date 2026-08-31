# Decisiones de diseño — BiblioChile Backend

## 2026-07-08 — Modelo de base de datos

### Separación de autores
- `Author` separado en dos tablas: `Author` (contemporáneos con cuenta de
  usuario) y `PublicDomainAuthor` (históricos sin cuenta, registrados por admin)
- Razón: los autores históricos no necesitan login, dashboard ni recibir pagos

### Campo source reemplazado por is_free
- `Book.source` (string) reemplazado por `is_free` (boolean)
- Razón: el estado es binario (gratis o no), un booleano es más limpio y
  eficiente para queries. Posible evolución futura a string enumerado si
  aparecen más tipos de acceso.

### Regla de integridad en Book
- `Book` tiene `author_id` y `public_domain_author_id` ambos nullable
- Regla: siempre debe tener al menos uno de los dos — nunca ambos null
- Implementación: validada en `BookService` y schema Zod, no en la BD
- Razón: SQL estándar no soporta restricciones condicionales entre columnas

### Planes de suscripción
- Cambiado de `semanal/mensual` a `mensual/anual`
- Razón: más higiénico para el modelo de negocio y más común en apps similares

### Límite de libros por suscripción
- `SubscriptionPlan` agrega campo `max_rentals` (configurable por el admin)
- Razón: el límite es variable según el plan, no debe estar hardcodeado

### Modelo de pago a autores
- Enfoque A: pago por arriendo (cada arriendo cuenta como una unidad)
- Razón: simple de calcular con tabla `Rental`, suficiente para pagos simulados
- Implementación futura: cruzar con `ReadingProgress` para pago por lectura real

### Progreso anónimo
- `ReadingProgress` soporta usuarios anónimos via `anonymous_uuid`
- El UUID se guarda en cookie en el navegador del dispositivo
- Al crear cuenta, el progreso se transfiere via `POST /api/progress/sync`

## 2026-07-08 — Arquitectura y stack

### Hosting por capa
- Frontend: Vercel
- Backend: Render
- Base de datos: Neon (PostgreSQL)
- Razón: cada servicio en la plataforma más adecuada para su rol. Neon directo
  a Render es más limpio que pasar por Vercel Postgres para algo que no tiene
  relación con el frontend.

### PWA (pendiente — Sprint 7)
- BiblioChile será una Progressive Web App
- Razón: usuarios en Metro de Santiago con conectividad intermitente en túneles.
  El libro se cachea al abrirlo para lectura offline sin interrupciones.
- Estrategia de caché:
  - Cachear siempre: contenido del libro activo
  - Cachear con límite: últimos 3-5 libros visitados
  - No cachear: catálogo completo, dashboard, métricas
- Implementación: `vite-plugin-pwa` en el frontend al finalizar Sprint 3

## 2026-07-08 — Control de versiones

### Estrategia de branches
- `main`: solo recibe merges de sprints completos via Pull Request
- `sprint-X`: una rama por sprint, todo el trabajo va aquí
- Razón: trazabilidad clara por sprint, simple para proyecto individual
- Se descartó GitFlow por ser overhead innecesario para un desarrollador solo

## 2026-07-18 — Cierre Sprint 1

### Resumen de lo construido
- Proyecto Node.js inicializado con Express (patrón MVC)
- Estructura de carpetas: routes, middlewares, controllers, services, prisma
- Configuración de Prisma 7 con @prisma/adapter-pg y Pool de conexiones
- Schema de base de datos con 11 tablas normalizadas en 3FN migradas a Neon
- Seed inicial — usuario admin y planes de suscripción (mensual/anual)
- Endpoint GET /health funcionando y verificado
- Mockups HTML trazables con HU-01 a HU-10 commiteados en repo frontend
- Design system compartido (styles.css) con paleta oficial

### Decisiones técnicas del sprint
- Node 22 con ES Modules ("type": "module") — sintaxis import/export en todo el proyecto
- node --watch en vez de nodemon — nativo en Node 18+, sin dependencia extra
- Prisma 7 requiere driver adapter obligatorio — se usa @prisma/adapter-pg con Pool
- prisma/generated/ agregado a .gitignore — es código autogenerado, no se versiona
- Branch dev en Neon separado de production — migraciones de desarrollo no afectan producción
- seed configurado en prisma.config.ts bajo migrations.seed — no en package.json (cambio de Prisma 7)

### Estado de ramas
- main → rama central, contiene el Sprint 1 completo
- sprint-1 → rama de desarrollo del Sprint 1 (sin PR formal por orden de creación)
- A partir del Sprint 2 el flujo PR será: sprint-X → PR → main

## 2026-07-25 — Cambios en el modelo de datos (Sprint 2)

### Tabla QRCode — refactoring
- Eliminados campos: `url`, `target_book_id` (FK → Book)
- Agregados campos: `code` (String único), `gutendex_id` (Int)
- Razón: los libros de dominio público vienen de Gutendex en tiempo real,
  no se almacenan en la BD. El QR apunta al ID de Gutendex directamente,
  eliminando la dependencia con la tabla Book.

### Tabla Book — relación eliminada
- Eliminada relación `qrCodes QRCode[]`
- Razón: consecuencia del refactoring de QRCode — ya no hay FK entre ambas tablas

### Tabla User — campo name agregado
- Agregado campo `name String` como obligatorio
- Migración especial: fila existente (admin) recibió valor 'Admin' como default temporal
- Razón: necesario para identificar usuarios en el sistema más allá del email

## 2026-08-06 — Módulo de arriendos (Sprint 2)

### Endpoint POST /api/rentals
- Nuevo módulo (`rental.service.js` / `rental.controller.js` / `rental.routes.js`) que
  faltaba: el modelo `Rental` ya existía en el schema y `GET /subscriptions/me` ya
  contaba `rentals_used`, pero no había forma de crear un arriendo real
- Reglas implementadas:
  - Requiere suscripción con `status: "activa"` → si no existe, 403
  - El cupo (`max_rentals` del plan) se cuenta sobre el total de `Rental` asociados a
    la suscripción vigente (mismo criterio que ya usaba `getActiveSubscription`), no
    sobre arriendos concurrentes/no expirados
  - Si ya existe un arriendo vigente (no expirado) del mismo libro en la misma
    suscripción, se reutiliza en vez de descontar cupo de nuevo (evita doble cobro
    por reabrir un libro ya arrendado)
  - `expires_at` del arriendo se fija igual a `end_date` de la suscripción — el
    arriendo dura mientras la suscripción esté activa
- `GET /api/rentals/me` lista los arriendos del usuario con el libro embebido

### Testing del sprint
- Pruebas unitarias con Vitest sobre la capa de servicio, mockeando Prisma (sin BD
  real) — cubren login, suscripción, progreso de lectura y arriendos
- Documentación de cada prueba (formato solicitado por el profesor, 3 escenarios:
  mejor caso / caso inválido / campos vacíos) en `docs/pruebas-unitarias/`
- La validación de "campos vacíos" se prueba contra el schema Zod correspondiente, no
  contra el servicio — es ahí donde realmente ocurre en el pipeline (middleware
  `validate()` antes del controller)

## 2026-08-07 — CI en GitHub Actions + Auto-Deploy condicionado en Render

### Workflow `.github/workflows/test.yml`
- Corre `npm ci`, `npx prisma generate` y `npm test` en cada push/PR a `main`, en Node 22
- Razón: Render permite configurar el Auto-Deploy en modo "After CI Checks Pass" (en vez de
  "On Commit"), pero esa opción depende de que exista un status check de CI reportado a
  GitHub sobre el commit — sin este workflow, la opción no tenía ningún check que esperar y
  equivalía en la práctica a "On Commit"
- Con el workflow en su lugar, Render en `main` queda configurado en "After CI Checks Pass":
  un commit con tests fallando en `main` no dispara el deploy a producción

## 2026-08-10 — Fix: ReadingProgress fallaba para libros gratuitos de Gutendex

### El problema
- `ReadingProgress.book_id` tiene FK real a `Book.id` en Postgres, pero `Book`
  nunca se puebla para el catálogo gratuito: `BookService` sirve los libros
  100% en vivo desde Gutendex, sin persistirlos
- Resultado: `POST /api/progress` para cualquier libro de dominio público
  (el caso de uso más común del proyecto) fallaba con un 500 crudo —
  violación de foreign key de Postgres sin capturar, subiendo tal cual hasta
  el controller
- La tabla `Book` está vacía en cualquier ambiente recién sembrado: no existe
  ningún `create`/`upsert` sobre `Book` en el seed ni en ningún otro punto
  del backend

### Por qué RentalService se mantiene sin cambios
- `Rental` está scopeado a obras de autores nacionales contemporáneos
  (`Author`, no `PublicDomainAuthor`), que generan pago real y por tanto
  deben existir como filas reales en `Book` de antemano (con `author_id`,
  `content_url` propio, etc.)
- Auto-crear un `Book` "fantasma" al momento de arrendar rompería esa regla
  de integridad y permitiría arrendar (cobrar) libros que nadie registró
  formalmente — el 404 actual ("Libro no encontrado") es el comportamiento
  correcto para ese flujo y no se toca

### Cómo quedó resuelto ProgressService
- `saveProgress` ahora llama a `ensureBookExists(bookId)` antes del upsert
  de `ReadingProgress`:
  - Si el `Book` ya existe localmente (gratuito o de pago), sigue igual
  - Si no existe, se consulta `BookService.getBookById` contra Gutendex:
    - Si el libro existe ahí, se crea automáticamente en `Book` con
      `is_free: true` y los datos mínimos disponibles (mismo `id` que el de
      Gutendex, siguiendo la misma convención que ya usaba `RentalService`)
    - Si no existe en Gutendex tampoco (caso de un libro de pago sin fila en
      `Book`), se lanza `"Libro no encontrado"` — mismo mensaje/semántica que
      usa `RentalService`, sin crear nada
- Se envuelven los `upsert` en try/catch para traducir cualquier falla real
  de base de datos a un mensaje de negocio (`502`) en vez de un 500 crudo

### Deuda técnica conocida
- Usar `id: bookId` explícito (en vez de dejar que Prisma autoincrement asigne
  el id) crea un riesgo real de colisión: cuando el contador interno de
  autoincrement de `Book`, en su conteo normal (1, 2, 3...), alcance por
  coincidencia un número ya usado como ID de Gutendex (ej. 2000, usado por
  Don Quijote), el `INSERT` de una fila nueva de autor nacional (HU-06,
  Sprint 3) fallará con `UniqueConstraintViolation`
- La solución correcta es agregar un campo `gutendex_id` (`Int?`, `@unique`)
  separado de `id`, y hacer que `ProgressService` y `RentalService` busquen
  por ese campo en vez de por `id` — pero se pospone deliberadamente para
  priorizar el plazo de la entrega académica actual
- Este fix debe aplicarse antes de implementar HU-06 en Sprint 3

## 2026-08-20 — Fix: desfase de versión Prisma CLI/client + resolución del riesgo de colisión de ID en Book

### Desfase de versión Prisma CLI/client
- Se detectó que `prisma` (CLI) estaba en `7.9.1` mientras `@prisma/client`
  seguía en `7.8.0` — probablemente causa raíz del error
  `Invalid prisma.X.findUnique() invocation` sin detalle observado durante
  la presentación de Sumativa 2 (nunca diagnosticado en su momento)
- Se alinearon ambos paquetes a `7.9.1` (última estable) en `package.json`,
  se corrió `npx prisma generate` y se confirmó `npx vitest run` en verde
  (44/44) antes de continuar

### Resolución del riesgo de colisión de ID en Book (deuda técnica de la
### entrada anterior)
- Se agregó `gutendex_id Int? @unique` a `Book` (migración
  `20260820233108_add_gutendex_id_to_book`), separado del `id` interno
  (`Int @id @default(autoincrement())`, que ya no recibe un valor explícito
  igual al de Gutendex en ningún `create`/`upsert`)
- `ProgressService.ensureBookExists()` ahora:
  1. Busca primero por `id` interno (caso de un libro de pago ya existente)
  2. Si no existe, busca por `gutendex_id` (caso de un libro gratuito ya
     sincronizado previamente)
  3. Si tampoco existe, consulta Gutendex y crea el `Book` con
     `gutendex_id: bookId` (no `id: bookId`) — el `id` interno lo asigna el
     autoincrement de Postgres, sin riesgo de colisión futura
- `saveProgress()` usa el `id` interno devuelto por `ensureBookExists()`
  como FK real de `ReadingProgress.book_id` (antes usaba el `bookId`
  externo directamente, que ahora puede diferir del interno)
- `getProgress()` devuelve `bookId: book.gutendex_id ?? book.book_id` para
  mantener el contrato externo esperado por el frontend (id de Gutendex
  para libros gratuitos, id interno para libros de pago)
- `RentalService.createRental()` se revisó y **no requirió cambios**: nunca
  crea filas de `Book` con un `id` explícito, solo busca por `id` interno
  libros de pago que ya deben existir (creados por el flujo de autor,
  Módulo 4) — no tiene la convención riesgosa que sí tenía `ProgressService`
- Tabla `Book` local estaba vacía al momento del fix (sin datos que
  backfillear)

### CORS
- Se reemplazó `cors()` sin argumentos (permite cualquier origen) por una
  whitelist explícita: `http://localhost:4173` (preview build) y
  `http://localhost:5173` (dev server). Queda un `TODO` en `server.js`
  señalando dónde agregar el dominio real de producción del frontend
  (Vercel) cuando exista

## 2026-08-25 — Fix: `approveAuthor` no sincronizaba `User.role` + verificación E2E de los 5 flujos de Sprint 3

### El problema (detectado durante verificación del contrato de login con el frontend)
- Las rutas de autor (`POST /api/authors/books`, `GET /api/authors/me/stats`)
  están gateadas por `requireRole('autor')`, que lee `req.user.role` — el
  `role` firmado en el JWT en el momento del login, no `Author.status`
- `approveAuthor()` solo actualizaba `Author.status` a `"aprobado"`; nunca
  tocaba `User.role`. Resultado: un pasajero que declaraba autoría y era
  aprobado por el admin quedaba **permanentemente bloqueado** por
  `requireRole('autor')`, salvo que se hubiera autodeclarado `role: "autor"`
  desde el registro original (que no es el flujo que el producto espera —
  cualquiera puede marcar ese campo al registrarse, la aprobación real la
  da el admin)

### La solución
- `approveAuthor()` ahora actualiza `Author.status` y `User.role: "autor"`
  en la misma `$transaction`, para que no puedan quedar desincronizados si
  uno de los dos `update` falla
- `rejectAuthor()` deliberadamente **no** toca `User.role` — un rechazo
  nunca debe promover a nadie, ni siquiera transitoriamente
- Consecuencia esperada del diseño con JWT (no un bug adicional): un token
  emitido *antes* de la aprobación sigue firmado con `role: "pasajero"` y
  sigue viendo `403` en rutas de autor hasta que el usuario vuelva a
  loguearse — el JWT no se actualiza solo cuando cambia el `role` en la BD.
  Confirmado explícitamente en `EC-PI-007` (Escenario 4) y en `EC-E2E-004`
  (Flujo 4, pasos 5 y 6)
- Pendiente de decisión de producto (no resuelto acá): si esta limitación
  amerita comunicarse en la UI ("tu cuenta fue aprobada, vuelve a iniciar
  sesión") en vez de que el usuario vea un 403 sin explicación

### Verificación E2E de los 5 flujos de Sprint 3 (Fase 5)
- Se ejecutaron los 5 flujos completos de usuario (pasajero nuevo, acceso
  por QR, suscripción→arriendo→lectura de pago, autor aprobado, autor
  rechazado) como secuencias reales de peticiones HTTP contra el backend +
  Postgres local — documentado en detalle en
  `bibliochile-frontend/env/respuesta_fase5.md` (formato `EC-E2E-001` a
  `EC-E2E-005`)
- **5/5 flujos PASS por HTTP.** El backend sostiene correctamente los 5
  flujos que Sprint 3 necesita
- Hallazgo colateral (no un bug, sí relevante para el frontend): un `Book`
  gratuito auto-sincronizado por `ensureBookExists()` (`progress.service.js`)
  nunca queda vinculado a un `PublicDomainAuthor` — así que
  `GET /api/progress` devuelve `book.author: null` para cualquier libro
  gratuito recién sincronizado. Si "Continuar leyendo" en el dashboard
  necesita mostrar el autor, hoy no lo tiene para esos casos
- Confirmado (no nuevo, ya sabido desde el reporte de estado del
  2026-08-24, pero re-confirmado acá con evidencia fresca): de los 5
  flujos, solo el de QR (`EC-E2E-002`) tiene su vista real conectada en el
  frontend hoy. Los otros 4 dependen de pantallas de Módulo 4/5/Rental que
  siguen sin construir del lado frontend — la verificación E2E deja el
  backend listo para cuando existan
  (Vercel) cuando exista
## 2026-08-26 — Fix: catálogo de pago local invisible + `GET /api/books/paid`

- Hueco de arquitectura reportado en `env/Prompt_backend_libros_pago.md`:
  `GET /api/books` solo consulta Gutendex por diseño (`book.service.js` no
  toca Prisma para ese endpoint) — así que los `Book` locales con
  `is_free: false` subidos por autores nacionales (vía
  `POST /authors/books`) nunca aparecían en ningún listado. Un autor
  aprobado podía publicar una obra que literalmente nadie podía descubrir
- Se evaluó la alternativa de que `GET /books` combinara ambas fuentes
  (Gutendex + Postgres) en una sola respuesta paginada, pero se descartó:
  mezclar un catálogo paginado externo (Gutendex, cientos de miles de
  libros) con uno pequeño y local complica la paginación sin necesidad real
  hoy, y el prompt ya preveía que el frontend quiere mostrar el catálogo de
  pago en una sección aparte, no mezclado con los resultados gratuitos
- Implementado: `getPaidBooks()` en `book.service.js` (nueva, junto a
  `getBooks`/`getBookById`) — `prisma.book.findMany({ where: { is_free:
  false } })` con `include: { author: { include: { user: true } } }`,
  mapeado al **mismo shape** que usa `getBooks` (`id`, `title`, `author`,
  `description`, `cover_url`, `content_url`, `is_free`) para que el
  frontend reuse el mismo componente de card en ambos catálogos. Sin
  paginación (no se necesita para el volumen esperado)
- Ruta: `GET /api/books/paid`, pública (sin `optionalAuth` ni
  `verifyToken` — el catálogo de pago debe verse sin sesión, igual que el
  gratuito; la sesión solo se necesita para arrendar/leer). Montada
  **antes** de `GET /:id` en `book.routes.js` — si no, Express interpreta
  `"paid"` como el parámetro `:id` y la ruta nunca se alcanza
- Libros sin `author_id` (dato huérfano/legado) caen a `"Autor
  desconocido"`, igual que el fallback ya existente para Gutendex — no
  rompen la ruta
- Tests: 3 nuevos en `tests/unit/book.service.test.js` (`EC-PU-005b`, mock
  de `prisma.book.findMany`) + 3 nuevos en
  `tests/integration/books.integration.test.js` (`EC-PI-002b`, HTTP real
  contra Postgres, cruzando registro→aprobación→publicación→catálogo).
  Suite completa: 117/117 tests, 17 archivos
- Ver detalle completo en `env/resultado_prompt_backend_libros_pago.md`

## 2026-08-27 — Fix crítico: `GET /books/:id` devolvía un libro de Gutendex distinto por colisión de id con un libro de pago local

- Bug real detectado y reportado en `env/Prompt_fix_getbookbyid_coleccion.md`:
  `getBookById(id)` consultaba **solo** Gutendex, sin mirar nunca la tabla
  `Book` local. Un libro de pago recién publicado (`id: 51`, autoincrement
  de Postgres) coincidía numéricamente con un id real de Gutendex
  ("Anne of the Island") — `GET /books/51` devolvía ese libro de Gutendex
  en vez del libro de pago real, con `is_free: true`. Esto **rompía por
  completo el control de acceso de Rental**: cualquiera veía el libro de
  pago como gratuito, saltándose la verificación de suscripción
- Fix: mismo patrón que ya usa `ProgressService.ensureBookExists()` —
  invertir el orden de búsqueda. `getBookById()` ahora consulta primero
  `prisma.book.findUnique({ where: { id } })` (con `include: { author: {
  include: { user: true } } }`); si existe localmente (de pago o gratuito
  ya sincronizado antes), lo devuelve directo, mapeado al mismo shape que
  ya devolvía la función (`id`, `title`, `author`, `description`,
  `cover_url`, `content_url`, `is_free`) — sin cambiar el contrato que
  consume `BookDetail.jsx`. Solo si no existe localmente cae a Gutendex,
  como antes
- Guard: si `id` no es un entero (`Number.isInteger` falla), no se
  consulta Prisma con `NaN` — cae directo a Gutendex, igual que antes del
  fix
- Caso borde verificado explícitamente (no asumido): un libro **gratuito**
  ya sincronizado localmente por `ensureBookExists()` también se sirve
  ahora desde Postgres por su id interno en vez de ir a Gutendex — no
  rompe `is_free`, y no afecta el flujo de QR/catálogo porque esos accesos
  usan `gutendex_id`, no el id interno (confirmado con test explícito,
  `EC-PI-002c` Escenario 2, y con la suite completa de QR sin cambios)
- Tests: 3 nuevos en `tests/unit/book.service.test.js` (`EC-PU-005c`,
  incluye "no consulta Gutendex si encuentra el libro local" verificado
  con `expect(fetch).not.toHaveBeenCalled()`) + 3 nuevos en
  `tests/integration/books.integration.test.js` (`EC-PI-002c`, repite
  **exactamente** la secuencia real que encontró el bug: autor aprobado →
  libro de pago → `GET /books/:id` → confirma `is_free: false` y los datos
  correctos, no los de Gutendex). Suite completa: 123/123 tests, 17
  archivos
- Ver detalle completo en `env/resultado_prompt_fix_getbookbyid_coleccion.md`

## 2026-08-27 — Batch de UX (autor/admin) + nuevo `GET /authors/me` + 2 investigaciones (sin fix)

**Batch de UX** (ver `env/prompt_batch_ux.md` y `env/resultado_prompt_batch_ux.md`):

- Backend: nuevo `GET /authors/me` (`verifyToken` únicamente, sin `requireRole`) — a
  diferencia de `/me/stats`, debe funcionar **antes** de la aprobación, para que el
  frontend muestre el estado real de la postulación (`hasApplication`, `status`,
  `rejectionReason`, `rejectionNote`) sin que `requireRole("autor")` lo bloquee mientras
  el `role` sigue siendo `"pasajero"`. `getMyAuthorStatus()` en `author.service.js` no
  lanza si no hay `Author` — es un estado válido (`{ hasApplication: false }`), a
  diferencia de `getAuthorByUserId()` que sí lanza (pensada para rutas que ya requieren
  ser autor)
- Frontend, `DashboardPasajero.jsx`: usa `GET /authors/me` para reemplazar el botón fijo
  "Registrarme como autor" por el estado real — pendiente (mensaje, sin botón para
  reenviar) o rechazado (motivo + nota real del admin). **Sin botón "volver a
  postular"**: `registerAuthor()` rechaza con 409 a cualquiera que ya tenga un `Author`
  sin mirar el `status`, así que hoy un rechazo es definitivo a nivel de backend — ofrecer
  un botón que siempre fallaría habría sido peor que no ofrecerlo. Queda como decisión de
  producto pendiente (¿debería un rechazo permitir reintentar?)
- Frontend, `AdminSubNav.jsx`: agregado botón "Cerrar sesión" (compartido por
  `AdminPanel.jsx`/`AdminAutores.jsx`) — antes el admin no tenía ninguna forma de salir
- Frontend, `RegistroAutor.jsx`: el checkbox de declaración jurada ya no deja el botón
  simplemente `disabled` sin explicación — ahora siempre es clickeable y muestra un
  mensaje visible si se intenta enviar sin aceptar
- Frontend, contraste en la sección de declaración jurada: `.bc-dj-text`/`.bc-dj-meta`
  pasaron de gris (`#555`/`#888`) sobre fondo crema a `var(--bg)` (el azul profundo de la
  paleta), mismo criterio que `.bc-dj-title`
- Tests: 3 nuevos en `tests/unit/author.service.test.js` (`EC-PU-009b`) + 3 nuevos en
  `tests/integration/author.integration.test.js` (`EC-PI-007b`) para `GET /authors/me`;
  frontend: `AdminSubNav.test.jsx` nuevo, `DashboardPasajero.test.jsx` y
  `RegistroAutor.test.jsx` actualizados. Backend 129/129 tests (17 archivos); frontend
  142/142 tests (23 archivos)

**Investigación de regresiones** (ver `env/prompt_investigar_regresiones.md` y
`env/resultado_prompt_investigar_regresiones.md`) — **sin fixes aplicados, por
instrucción explícita del prompt**:

- Causa confirmada (con `curl` real, reproducible) para "el progreso de lectura no
  persiste": `Reader.jsx` envía `bookId: id` (string, de `useParams()`) en vez de
  `Number(id)` — el schema Zod de `POST /progress` exige `z.number()`, así que el backend
  rechaza con `422` cada guardado, y `Reader.jsx` lo traga en silencio ("best-effort").
  Confirmado que NO es un problema del backend ni del schema
- Las otras 2 regresiones reportadas (QR inactivo muestra el mismo mensaje que "no
  encontrado"; suscripción duplicada no muestra error) no se pudieron reproducir por
  código ni por HTTP — el backend y el código fuente actual de `QRRedirect.jsx`/
  `Subscription.jsx` se revisaron íntegros y no muestran el defecto descrito. No hay
  browser disponible en esta sesión para confirmarlo en vivo (extensión de Chrome
  rechazada) — pendiente de verificación manual real o de que el usuario aporte el detalle
  exacto de la reproducción (URL, secuencia de clics, pestaña de red)
- No se encontró una causa común entre las 3 (se descartó la hipótesis de un interceptor
  de respuesta en `api.js`: no existe ninguno, y el archivo no ha cambiado desde el commit
  inicial)

**Investigación "Subir obra" no aparece tras aprobación + re-login** (ver
`env/prompt_investigar_subir_obra.md` y `env/resultado_prompt_investigar_subir_obra.md`)
— **sin fix, no se encontró el defecto**:

- Se repitió la secuencia real completa por HTTP (`curl`): registro pasajero → declarar
  autoría → aprobación admin real → re-login → el JWT y `user.role` del re-login son
  `"autor"`, correctos
- Se trazó el código completo (`Login.jsx` → `AuthContext.jsx` → `BottomNav.jsx` →
  `RequireRole.jsx` → `DashboardAutor.jsx` → rutas en `App.jsx`) sin encontrar ninguna
  inconsistencia — la cadena, tal como está en el repo hoy, debería funcionar
- Sin acceso a navegador esta sesión, no se pudo completar la verificación literal pedida
  (DevTools, `localStorage`, URL real tras "Perfil"). Hipótesis no confirmada: caché de un
  build viejo (el proyecto usa `vite-plugin-pwa` con `registerType: "autoUpdate"`, que solo
  registra el service worker fuera de `vite dev`) si la prueba manual se hizo contra
  `vite preview` con un build anterior a estos archivos

## 2026-08-27 — `PATCH /api/subscriptions`: cambiar de plan con suscripción vigente

Hueco de producto detectado al investigar la regresión "suscripción duplicada no muestra
error" (`env/prompt_investigar_regresiones.md`): `Subscription.jsx` oculta correctamente
el selector de planes mientras hay una suscripción activa (no era un bug), pero eso dejó
en evidencia que **no había forma de cambiar de plan** (ej. mensual → anual) sin esperar a
que expirara la vigente. Implementado por pedido explícito en
`env/prompt_cambio_plan_suscripcion.md`.

- `PATCH /api/subscriptions` (mismo body `{ planId }` y mismo schema Zod que
  `POST /api/subscriptions`), requiere `verifyToken`
- Sin prorrateo ni reembolso parcial (decisión explícita del prompt, para evitar cálculo
  de días no consumidos): con una suscripción activa existente, la cancela
  (`status: "cancelada"`) y crea la nueva de inmediato con el plan pedido → `200`
- Sin ninguna suscripción activa: se comporta igual que `POST /api/subscriptions`
  (mismas validaciones) → `201`
- `planId` inexistente → `404 Plan no encontrado`, sin tocar la suscripción activa
  existente (se valida el plan antes de cancelar nada)
- `subscription.service.js`: nueva función `changeSubscriptionPlan(userId, planId)`
- Tests: unitarios `EC-PU-002c` (3 nuevos, `tests/unit/subscription.service.test.js`) +
  integración `EC-PI-004b` (4 nuevos, `tests/integration/subscriptions.integration.test.js`,
  incluye verificación real en Postgres de que quedan 2 filas — la anterior `"cancelada"`,
  la nueva `"activa"` — y que `GET /subscriptions/me` refleja el plan nuevo de inmediato).
  Documentado en `EC-PU-002-suscripcion.md` y `EC-PI-004-subscriptions.md`. Suite completa:
  136/136 tests (17 archivos)

## 2026-08-31 — Decisión de alcance: sin aprobación a nivel de libro individual

Se evaluó agregar un flujo de aprobación a nivel de libro individual (distinto de la
aprobación de autor que ya existe, HU-09). Se decide **NO implementarlo**: ninguna HU del
proyecto lo exige — HU-06 solo pide que el autor pueda publicar una vez aprobado como
autor, y HU-09 es específicamente sobre aprobar la solicitud de autoría, no cada obra
subida. Agregarlo habría sido alcance adicional no comprometido, en un momento del
proyecto donde priorizamos cerrar al 100% lo que sí está definido en los requerimientos.

Queda documentado como decisión consciente de alcance (`env/prompt_backend_ajustes.md`),
no como algo que se pasó por alto.

## 2026-08-31 — Seed: datos de demostración para estadísticas de autor y lector

El libro de pago de demo (`autor-demo@bibliochile.cl`) no tenía ningún `ReadingProgress`
ni `Rental` asociado — `GET /authors/me/stats` mostraría todo en cero al loguearse como
ese autor. `prisma/seed.js` ahora agrega, después de crear el autor y libro de demo:

- 3 usuarios `pasajero` distintos (`lector-demo-1/2/3@bibliochile.cl`), cada uno con un
  `ReadingProgress` sobre el libro de demo con `progress_percentage` variado (25/60/90 —
  no todos en 0 o 100)
- 1 usuario `pasajero` adicional (`lector-demo-arriendo@bibliochile.cl`) con una
  `Subscription` activa (plan mensual, creada si no existe) y un `Rental` sobre el libro
  de demo

Ambos bloques son idempotentes (`upsert` para `ReadingProgress`, `findFirst` antes de
`create` para `Subscription`/`Rental` — que no tienen una clave natural para `upsert`),
así que correr `npx prisma db seed` más de una vez no duplica filas. Verificado
directamente: `getMyStats()` sobre el autor de demo devuelve
`{ totalBooks: 1, totalReaders: 3, avgProgressPercentage: 58.33, totalRentals: 1 }`, y una
segunda corrida del seed deja los mismos 3 `ReadingProgress` + 1 `Rental` (sin duplicar).
Suite completa tras el cambio: 136/136 tests (17 archivos).
