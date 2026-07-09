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