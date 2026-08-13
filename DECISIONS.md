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