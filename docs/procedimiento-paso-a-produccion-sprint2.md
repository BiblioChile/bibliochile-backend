### PROCEDIMIENTO DE PASO A PRODUCCIÓN

**Proyecto:** BiblioChile — Backend
**Entregable:** Sprint 2 — Módulos core (catálogo, QR, suscripciones, arriendos, progreso de lectura)
**Código del entregable:** ENT-SPRINT2-BACKEND
**Versión:** v1.0
**Fecha:** 06/08/2026
**Responsable del despliegue:** Sebastián Lara

---

### Objetivo

Realizar el despliegue de los módulos de catálogo, QR, suscripciones, arriendos y progreso de
lectura al ambiente de producción, asegurando la continuidad operacional de la API, la
integridad de los datos de suscripción/progreso ya existentes, y la correcta disponibilidad de
las nuevas funcionalidades para el frontend.

**Nota de contexto:** este proyecto es un trabajo de título individual sin usuarios reales en
producción todavía. El siguiente procedimiento simula el proceso que se seguiría en un
despliegue real, adaptado a los ambientes definidos en `DECISIONS.md` (Render + Neon).

---

### Ambientes y stack involucrados

| Capa            | Servicio | Detalle |
|------------------|----------|---------|
| Backend          | Render   | Node 22 + Express 5, deploy desde rama `main` |
| Base de datos    | Neon (PostgreSQL) | Branch `dev` para desarrollo, branch de producción separado |
| ORM / migraciones | Prisma 7 | `prisma migrate deploy` aplica migraciones sin generar nuevas |
| Frontend (consumidor) | Vercel | Consume la API vía `VITE_API_URL` — no forma parte de este entregable |

---

### Requisitos previos

Antes del despliegue se debe verificar que:

- Las pruebas unitarias de los módulos entregados en el sprint estén documentadas y en estado
  `PASS` (ver `docs/pruebas-unitarias/`) — ejecutadas con `npm test` (Vitest).
- El código esté mergeado en `sprint-2` y la Pull Request `sprint-2 → main` esté aprobada
  (flujo definido en `DECISIONS.md`, sección "Estrategia de branches").
- Las migraciones de Prisma generadas en `sprint-2` (unique constraints de `ReadingProgress`,
  modelo `Rental` ya existente) estén probadas contra el branch `dev` de Neon antes de aplicarse
  a producción.
- Estén configuradas las variables de entorno en Render: `DATABASE_URL` (branch de producción
  de Neon), `JWT_SECRET`, `PORT`.
- Se cuente con un respaldo (snapshot) del branch de producción de Neon previo al despliegue.

---

### Procedimiento

| Paso | Actividad | Responsable |
|------|-----------|-------------|
| 1 | Congelar cambios en `sprint-2` y crear/actualizar la PR hacia `main`. | Desarrollador |
| 2 | Ejecutar `npm test` localmente y confirmar que todos los tests unitarios pasan. | Desarrollador |
| 3 | Generar snapshot/respaldo del branch de producción de Neon. | Desarrollador (rol DBA) |
| 4 | Hacer merge de la PR `sprint-2 → main`. | Desarrollador |
| 5 | Verificar que Render dispare el deploy automático desde `main` (o disparar deploy manual). | Render (CI/CD) |
| 6 | Ejecutar `npx prisma migrate deploy` contra el branch de producción de Neon. | Desarrollador |
| 7 | Verificar que el servicio en Render inicie correctamente (`GET /health`). | Desarrollador |
| 8 | Ejecutar pruebas funcionales básicas de los endpoints nuevos/modificados (ver validaciones posteriores). | Desarrollador |
| 9 | Confirmar que el frontend en Vercel (apuntando a la URL de producción de Render) consume la API sin errores. | Desarrollador |
| 10 | Registrar el despliegue como cerrado en `DECISIONS.md`. | Desarrollador |

---

### Validaciones posteriores

Se debe comprobar el correcto funcionamiento de los siguientes endpoints:

- `POST /api/subscriptions` → crea suscripción y responde con el `.json()` correcto ante error
  (regresión del bug de respuesta colgada corregido este sprint).
- `POST /api/progress` (guardado repetido del mismo libro) → confirma que el `update` del
  upsert persiste (regresión del bug `update_at`/`Date()` corregido este sprint).
- `GET /api/progress` → devuelve el progreso guardado con el libro embebido.
- `POST /api/rentals` → arrienda un libro dentro del cupo del plan y rechaza correctamente
  fuera de cupo o sin suscripción activa.
- `GET /api/rentals/me` → lista los arriendos del usuario autenticado.

### Criterios de aceptación

El despliegue será considerado exitoso cuando:

- El servicio esté disponible (`GET /health` responde `200`).
- Los endpoints de suscripciones, progreso de lectura y arriendos respondan según lo esperado
  en las validaciones posteriores.
- Las migraciones se hayan aplicado sin pérdida de datos en `Subscription`, `Rental` ni
  `ReadingProgress`.
- No existan errores críticos en los logs de Render durante los primeros minutos post-deploy.
- Las pruebas unitarias documentadas en `docs/pruebas-unitarias/` sigan en estado `PASS` contra
  el código desplegado.
