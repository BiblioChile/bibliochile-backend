# 📚 BiblioChile — Backend

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-PostgreSQL-2496ED?logo=docker&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-MVP%20completo-success)

API REST de BiblioChile, plataforma de lectura digital para el transporte público de Santiago.
Proyecto de título de Ingeniería Civil en Computación (AINC410), Universidad Andrés Bello:
*Fomento de la Lectura en el Transporte Público de Santiago*.

Frontend: [bibliochile-frontend](https://github.com/BiblioChile/bibliochile-frontend)

---

## 📌 Caso de uso

> Un pasajero escanea un código QR en una estación y llega directo a una obra,
> que lee desde el celular sin registrarse. Si crea una cuenta, conserva su progreso.
> Los autores nacionales publican y los lectores acceden a ellos con una suscripción.

| Rol | Qué puede hacer |
|---|---|
| **Pasajero** | Explorar el catálogo, leer obras gratuitas, guardar su progreso (anónimo o con cuenta), contratar un plan y arrendar obras de autores chilenos |
| **Autor nacional** | Postular con RUT y declaración jurada, subir obras una vez aprobado y consultar estadísticas |
| **Administrador** | Aprobar o rechazar autores y gestionar los códigos QR |

---

## ⚙️ ¿Cómo funciona?

1. El cliente envía una petición HTTP a la API.
2. Los **middlewares** verifican el token (`verifyToken` / `optionalAuth`), el rol (`requireRole`) y validan el cuerpo con Zod.
3. El **controller** recibe la petición y delega en el **service**.
4. El **service** aplica las reglas de negocio y consulta la base mediante Prisma.
5. Las obras gratuitas se leen desde Gutendex; las de autores nacionales, desde PostgreSQL.

```
Cliente → routes → middlewares → controllers → services → Prisma → PostgreSQL
                                                   ↕
                                            Gutendex (catálogo gratuito)
```

Puntos de diseño que conviene conocer:

- `src/server.js` exporta `app` y solo levanta el servidor cuando se ejecuta directamente, así Supertest importa la app sin abrir un puerto.
- Las obras gratuitas viven en Gutendex. `Book.gutendex_id` (único, nulo en obras locales) es independiente del `Book.id` autoincremental. Una obra gratuita se copia a la tabla `Book` la primera vez que se guarda progreso sobre ella (`ensureBookExists`). `getBookById` busca primero en la tabla local y luego en Gutendex.
- Aprobar un autor actualiza `Author.status` y `User.role` en una transacción. El JWT ya emitido queda desactualizado hasta que el usuario inicie sesión de nuevo.

---

## 🚀 Instalación y ejecución local

Es el único ambiente oficial del proyecto: Node + PostgreSQL en Docker, sobre HTTP, sin TLS.

**Requisitos:** Node.js 22, Docker y Git.

**1. Clonar ambos repositorios lado a lado**

```bash
git clone https://github.com/BiblioChile/bibliochile-backend.git
git clone https://github.com/BiblioChile/bibliochile-frontend.git
```

**2. Levantar PostgreSQL 16**

```bash
docker run --name bibliochile-db -e POSTGRES_PASSWORD=<tu_password> -e POSTGRES_DB=bibliochile -p 5432:5432 -d postgres:16
```

**3. Configurar y levantar el backend**

```bash
cd bibliochile-backend
npm install
```

Crea un archivo `.env` con las variables de la sección [Variables de entorno](#-variables-de-entorno), y luego:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Para modo producción: `NODE_ENV=production node src/server.js`.

> ⚠️ `prisma.config.ts` exige `DATABASE_URL` incluso para `prisma generate`, así que el `.env` debe existir antes de generar el cliente.

**4. Verificar**

```bash
curl http://localhost:<PORT>/health
```

**5. Levantar el frontend**

```bash
cd ../bibliochile-frontend
npm install
npm run dev                                  # http://localhost:5173
# o la versión compilada:
npm run build && npm run preview -- --host   # http://localhost:4173
```

---

## 🔐 Variables de entorno

Solo nombres; los valores van en tu `.env` local, que no se sube al repositorio.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Firma de los tokens |
| `PORT` | Puerto de la API |
| `ADMIN_PASSWORD` | Contraseña del administrador que crea el seed |
| `DEMO_AUTHOR_PASSWORD` | Contraseña del autor demo |
| `DEMO_READER_PASSWORD` | Contraseña de los lectores demo |
| `FRONTEND_URL` | Origen del frontend permitido por CORS |
| `LAN_ORIGIN` | Origen adicional para CORS (pruebas desde el celular en la red local) |

CORS acepta una lista blanca: `localhost:4173`, `localhost:5173`, `LAN_ORIGIN` y `FRONTEND_URL`.

---

## 🌱 Datos que crea el seed

`npx prisma db seed` deja la base lista para una demo:

- Administrador `admin@bibliochile.cl`.
- Planes de suscripción mensual y anual.
- Códigos QR `BCH-001` y `BCH-002` activos, y `BCH-003` inactivo.
- Autor demo aprobado (`autor-demo@bibliochile.cl`) con una obra de pago.
- Lectores demo `lector-demo-1`, `-2` y `-3` (`@bibliochile.cl`) con progreso de 25 %, 60 % y 90 %.
- Lector con suscripción activa y arriendo (`lector-demo-arriendo@bibliochile.cl`).

Las contraseñas salen de las variables de entorno; los valores por defecto de desarrollo están en `prisma/seed.js`.

---

## 🔌 Endpoints

Autenticación mediante `Authorization: Bearer <token>`. Los nombres exactos de ruta están en `src/routes/`.

| Módulo | Método | Ruta | Acceso |
|---|---|---|---|
| Salud | GET | `/health` | Público |
| Auth | POST | `/auth/register` · `/auth/login` | Público |
| Libros | GET | `/books` | Público (gratuitos vía Gutendex) |
| Libros | GET | `/books/paid` | Público (autores nacionales) |
| Libros | GET | `/books/:id` | Público |
| QR | GET | `/qr/:code` | Público |
| QR | PATCH | `/qr/:id/activate` · `/qr/:id/deactivate` | Admin |
| Suscripciones | GET | `/subscriptions/plans` | Público |
| Suscripciones | POST · GET | `/subscriptions` · `/subscriptions/me` | Autenticado |
| Suscripciones | PATCH | `/subscriptions` | Autenticado (cambia de plan: cancela la activa, sin prorrateo) |
| Arriendos | POST · GET | `/rentals` · `/rentals/me` | Autenticado con suscripción activa |
| Progreso | POST · GET | `/progress` | Opcional (usuario o UUID anónimo) |
| Progreso | POST | `/progress/sync` | Autenticado (migra el progreso anónimo a la cuenta) |
| Autores | POST | `/authors` | Autenticado (RUT + declaración jurada) |
| Autores | GET | `/authors/me` | Autenticado |
| Autores | POST · GET | `/authors/books` · `/authors/stats` | Autor aprobado |
| Admin | GET | `/admin/authors/pending` | Admin |
| Admin | PATCH | `/admin/authors/:id/approve` | Admin |
| Admin | PATCH | `/admin/authors/:id/reject` | Admin (motivo `problema_sistema` u `otro`, con `rejection_note`) |

---

## 🗄️ Base de datos

11 tablas normalizadas en 3FN: `User`, `Author`, `PublicDomainAuthor`, `Genre`, `Book`, `BookGenre`, `SubscriptionPlan`, `Subscription`, `Rental`, `ReadingProgress` y `QRCode`.

- `Book` pertenece a un autor nacional **o** a uno de dominio público, nunca a ambos.
- `ReadingProgress` pertenece a un usuario **o** a un UUID anónimo, nunca a ambos.
- `QRCode` tiene `is_active`: un QR desactivado responde "QR inactivo"; uno inexistente, "QR no encontrado".

---

## 🗂️ Estructura del proyecto

```
bibliochile-backend/
│
├── prisma/
│   ├── schema.prisma        # Modelo de datos
│   ├── migrations/          # Migraciones
│   └── seed.js              # Datos demo
│
├── src/
│   ├── server.js            # Arranque (exporta app)
│   ├── routes/              # Definición de rutas
│   ├── middlewares/         # Auth, roles, validación Zod
│   ├── controllers/         # Capa HTTP
│   └── services/            # Reglas de negocio y acceso a datos
│
├── tests/
│   ├── unit/                # Prisma mockeado
│   └── integration/         # Supertest contra PostgreSQL real
│
├── docs/pruebas-unitarias/  # Fichas EC-PU-xxx y EC-PI-xxx
├── .github/workflows/       # CI
├── prisma.config.ts
├── DECISIONS.md             # Decisiones de diseño
└── README.md
```

---

## 📦 Dependencias principales

| Paquete | Descripción |
|---|---|
| `express` 5.2.1 | Framework HTTP |
| `prisma` / `@prisma/client` 7.9.1 | ORM (CLI y cliente deben tener la misma versión) |
| `@prisma/adapter-pg` + `pg` | Conexión a PostgreSQL |
| `zod` 4.4.3 | Validación de entradas |
| `jsonwebtoken` 9.0.3 | Tokens JWT |
| `bcryptjs` | Hash de contraseñas |
| `cors` · `dotenv` | CORS y variables de entorno |
| `vitest` · `supertest` | Pruebas unitarias e integración |

---

## 🛠️ Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor en modo desarrollo |
| `npm test` | Vitest en modo *watch* |
| `npm test -- --run` | Vitest una sola vez |
| `npx prisma migrate deploy` | Aplica las migraciones |
| `npx prisma db seed` | Carga los datos demo |

---

## 🧪 Pruebas

| Nivel | Dónde | Comando |
|---|---|---|
| Unitarias | `tests/unit` | `npx vitest run tests/unit` |
| Integración | `tests/integration` | `npx vitest run tests/integration --testTimeout=30000` |
| Aceptación | Recorrido manual con `curl` | No automatizada |

Las de integración necesitan la base migrada y con el seed cargado (las de QR usan los códigos del seed). Algunas consultan Gutendex real, de ahí el *timeout* ampliado. Las fichas de cada caso están en `docs/pruebas-unitarias/`.

**Integración continua:** `.github/workflows/test.yml` ejecuta las pruebas unitarias en cada push y pull request a `main`. Las de integración se ejecutan localmente, porque necesitan base de datos y secretos que no están disponibles en un pull request.

---

## ⚠️ Decisiones y limitaciones conocidas

El detalle está en [`DECISIONS.md`](./DECISIONS.md). Lo principal:

- **Ambiente oficial local.** Se probó un despliegue en la nube, pero Gutendex responde 403 (protección anti-bot) a las IP de datacenter, y el catálogo gratuito no funcionaba allí.
- **Sin pasarela de pago:** la contratación registra la suscripción, no cobra.
- **Sin alta disponibilidad ni escalado horizontal.**
- **JWT en `localStorage` del frontend:** riesgo ante XSS, aceptado y documentado.
- **HTTP sin TLS** en el ambiente local.
- **Sin aprobación por obra:** se aprueba al autor, no cada libro.
- **El JWT no se refresca solo** al cambiar el rol: hay que iniciar sesión de nuevo.

---

## ✅ Estado del desarrollo

| Etapa | Estado |
|---|---|
| Sprint 1 | ✅ |
| Sprint 2 — módulos core | ✅ |
| Sprint 3 — módulos complementarios | ✅ |
| Pruebas unitarias e integración | ✅ |
| Documentación y defensa | ✅ |

---

## 👤 Autor

**Sebastián Lara**
- GitHub: [@seba-lara](https://github.com/seba-lara)
