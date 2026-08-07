# BiblioChile — Backend

API REST para la plataforma BiblioChile, una aplicación web responsiva que fomenta la lectura de literatura nacional chilena mediante códigos QR en el transporte público de Santiago.

**Proyecto de título** — Ingeniería Civil en Computación (AINC410) · UNAB 2026  
**Profesor guía:** Pedro Veloso Hernández  
**Metodología:** Ágil con framework Scrum · 26 semanas (T1 + T2)

---

## Stack tecnológico

| Herramienta | Versión | Rol |
|---|---|---|
| Node.js | 22 | Runtime JavaScript del servidor |
| Express | 5.x | Framework HTTP — servidor y rutas |
| Prisma ORM | 7.x | Acceso a base de datos |
| PostgreSQL | — | Motor de base de datos |
| Neon | — | Hosting cloud de PostgreSQL |
| Zod | 4.x | Validación de datos de entrada |
| jsonwebtoken | 9.x | Generación y verificación de tokens JWT |
| bcryptjs | 3.x | Hash seguro de contraseñas |
| dotenv | 17.x | Variables de entorno |
| cors | 2.x | Política de recursos entre orígenes |
| pg | 8.x | Driver nativo PostgreSQL para Node.js |
| @prisma/adapter-pg | 7.x | Adaptador Prisma para driver pg |

**Testing:** Vitest · Supertest  
**Deploy:** Render

---

## Arquitectura

El backend sigue el patrón **MVC** con separación en capas:

```
Petición HTTP
     ↓
[ Routes ]         → define URLs y métodos HTTP
     ↓
[ Middlewares ]    → autenticación, roles, validación con Zod
     ↓
[ Controllers ]    → maneja req/res, delega al servicio
     ↓
[ Services ]       → lógica de negocio
     ↓
[ Prisma Client ]  → consultas a PostgreSQL
     ↓
[ PostgreSQL/Neon ]
```

### Estructura de carpetas

```
src/
├── routes/              → definición de endpoints por módulo
├── middlewares/         → auth, roles, validación
├── controllers/         → manejo de request/response
├── services/            → lógica de negocio
├── schemas/             → schemas de validación Zod
└── prisma/
    └── client.js        → instancia de PrismaClient

prisma/
├── schema.prisma        → definición de las 11 tablas
├── seed.js              → datos iniciales
└── migrations/          → historial de migraciones
```

---

## Base de datos

**11 tablas normalizadas en 3FN:**

| Tabla | Descripción |
|---|---|
| User | Usuarios del sistema (pasajero, autor, admin) |
| PublicDomainAuthor | Autores históricos sin cuenta (dominio público) |
| Author | Autores nacionales contemporáneos con cuenta |
| Genre | Géneros literarios |
| Book | Catálogo de obras (is_free distingue acceso) |
| BookGenre | Relación muchos a muchos Book ↔ Genre |
| SubscriptionPlan | Planes disponibles (mensual / anual) |
| Subscription | Suscripciones activas por usuario |
| Rental | Registro de arriendos (base para pagos a autores) |
| ReadingProgress | Progreso de lectura (anónimo y registrado) |
| QRCode | Códigos QR físicos por estación |

---

## Justificación de dependencias

### Producción

**Express** — framework HTTP minimalista y flexible. Elegido por su amplia adopción en el mercado laboral chileno, documentación extensa y compatibilidad con el patrón MVC implementado.

**Prisma ORM** — ORM moderno con schema declarativo, migraciones automáticas y cliente tipado. Elegido sobre Sequelize por su mejor soporte para PostgreSQL, sintaxis más clara y herramientas de desarrollo (Prisma Studio).

**Zod** — librería de validación con inferencia de tipos. Elegida sobre Joi por su integración natural con ES Modules y su capacidad de limpiar datos de entrada automáticamente.

**jsonwebtoken** — implementación estándar de JWT para Node.js. Permite autenticación stateless sin necesidad de sesiones en servidor.

**bcryptjs** — implementación pura de JavaScript del algoritmo bcrypt. Elegida sobre bcrypt (nativa) por su compatibilidad sin dependencias de compilación en entornos de deploy.

**dotenv** — carga variables de entorno desde `.env`. Separa la configuración del código fuente.

**cors** — middleware que habilita Cross-Origin Resource Sharing. Necesario para que el frontend en Vercel pueda comunicarse con el backend en Render.

**pg + @prisma/adapter-pg** — driver nativo de PostgreSQL requerido por Prisma 7 para conexión mediante Pool de conexiones. El Pool maneja múltiples conexiones simultáneas de forma eficiente.

### Desarrollo

**Vitest** — framework de testing moderno, compatible con ES Modules. Elegido sobre Jest por su configuración zero y soporte nativo para el stack del proyecto.

**Supertest** — permite probar endpoints HTTP sin levantar el servidor real. Se integra directamente con la instancia de Express exportada desde server.js.

---

## Endpoints disponibles

### Sprint 1 — Fundación
```
GET  /health                       → verifica que el servidor está activo
```

### Sprint 2 — Módulos core

**Autenticación**
```
POST /api/auth/register            → registro de usuario
POST /api/auth/login               → login y obtención de token JWT
```

**Catálogo** (integración con Gutendex)
```
GET  /api/books                    → lista libros (filtros: search, genre, page)
GET  /api/books/:id                → detalle de un libro
```

**Códigos QR**
```
GET  /api/qr/:code                 → escanea un QR físico y redirige al libro
```

**Suscripciones**
```
GET  /api/subscriptions/plans      → lista planes disponibles (mensual / anual)
POST /api/subscriptions            → suscribe al usuario autenticado a un plan
GET  /api/subscriptions/me         → suscripción activa del usuario, plan y arriendos usados
```

**Arriendos**
```
POST /api/rentals                  → arrienda un libro bajo la suscripción activa
GET  /api/rentals/me                → lista los arriendos del usuario autenticado
```

**Progreso de lectura** (usuarios registrados y anónimos vía `anonymousUuid`)
```
GET  /api/progress                 → progreso guardado (propio o por anonymousUuid)
POST /api/progress                 → guarda/actualiza progreso de un libro
POST /api/progress/sync            → migra progreso anónimo a la cuenta al hacer login
```

---

## Instalación y uso

### Requisitos
- Node.js 22+
- Cuenta en Neon (PostgreSQL)

### Configuración

```bash
# Clonar el repositorio
git clone https://github.com/bibliochile/bibliochile-backend.git
cd bibliochile-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL y JWT_SECRET

# Ejecutar migraciones
npx prisma migrate dev

# Cargar datos iniciales
npx prisma db seed

# Iniciar servidor
npm run dev
```

### Variables de entorno requeridas

```
DATABASE_URL=""     # Connection string de Neon (branch dev)
JWT_SECRET=""       # Clave secreta para firmar JWT
PORT=3000
```

### Scripts disponibles

```bash
npm run dev     # servidor con recarga automática (node --watch)
npm run start   # servidor en producción
npm run test    # tests con Vitest
```

---

## Pruebas

Pruebas unitarias con **Vitest**, mockeando Prisma (no requieren base de datos real).

```
tests/unit/                              → tests unitarios por servicio
docs/pruebas-unitarias/                  → documentación de cada prueba (objetivo,
                                            escenarios, resultado esperado/obtenido)
docs/procedimiento-paso-a-produccion-*.md → procedimiento de despliegue por sprint
```

---

## Estado del desarrollo

| Sprint | Semanas | Módulo | Estado |
|---|---|---|---|
| Sprint 1 | S14–S17 | Análisis, diseño, arquitectura, mockups | ✅ Completo |
| Sprint 2 | S18–S21 | Módulos core — catálogo, QR, suscripciones, progreso | 🔄 En progreso |
| Sprint 3 | S22–S25 | Módulos complementarios, integración y certificación | ⬜ Pendiente |
| Etapa Final | S25–S26 | Consolidación, informe final, defensa | ⬜ Pendiente |

---

## Decisiones de diseño

Ver [`DECISIONS.md`](./DECISIONS.md) para el historial completo de decisiones técnicas y de arquitectura tomadas durante el desarrollo.