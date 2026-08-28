import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.ts";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {

  // 1. Crear usuario administrador
  // La password se lee de ADMIN_PASSWORD (variable de entorno) para no dejar
  // credenciales hardcodeadas en el repo. En dev, si no se define, se usa un
  // valor por defecto y se avisa por consola.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn(
      "ADMIN_PASSWORD no está definida — usando password por defecto 'admin1234' (solo para desarrollo)."
    );
  }
  const hashedPassword = await bcrypt.hash(adminPassword || "admin1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bibliochile.cl" },
    update: {},
    create: {
      email: "admin@bibliochile.cl",
      password: hashedPassword,
      role: "admin",
      name: "Admin BiblioChile"
    },
  });

  console.log("Admin creado:", admin.email);

  // 2. Crear planes de suscripción
  const planMensual = await prisma.subscriptionPlan.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "mensual",
      duration_days: 30,
      price: 3990,
      max_rentals: 5,
    },
  });

  const planAnual = await prisma.subscriptionPlan.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "anual",
      duration_days: 365,
      price: 35990,
      max_rentals: 8,
    },
  });
  console.log("Planes creados:", planMensual.name, planAnual.name);

  // 3. Crear códigos QR de prueba
  const qr1 = await prisma.qRCode.upsert({
    where: { code: "BCH-001" },
    update: {},
    create: {
      code: "BCH-001",
      location_name: "Estación Baquedano, andén sur",
      gutendex_id: 2000,    // Don Quijote
      is_active: true,
      created_by: admin.id,
    },
  });

  const qr2 = await prisma.qRCode.upsert({
    where: { code: "BCH-002" },
    update: {},
    create: {
      code: "BCH-002",
      location_name: "Estación Universidad de Chile, andén norte",
      gutendex_id: 21282,   // Tradiciones peruanas
      is_active: true,
      created_by: admin.id,
    },
  });

  const qr3 = await prisma.qRCode.upsert({
    where: { code: "BCH-003" },
    update: {},
    create: {
      code: "BCH-003",
      location_name: "Estación Tobalaba, andén sur",
      gutendex_id: 67979,   // QR inactivo para pruebas
      is_active: false,
      created_by: admin.id,
    },
  });

  console.log("QRs creados:", qr1.code, qr2.code, qr3.code);

  const demoAuthorPassword = await bcrypt.hash(
    process.env.DEMO_AUTHOR_PASSWORD || "autor12345",
    10
  );

  const demoAuthorUser = await prisma.user.upsert({
    where: { email: "autor-demo@bibliochile.cl" },
    update: {},
    create: {
      email: "autor-demo@bibliochile.cl",
      password: demoAuthorPassword,
      role: "autor",
      name: "Autor Demo BiblioChile",
    },
  });

  const demoAuthor = await prisma.author.upsert({
    where: { user_id: demoAuthorUser.id },
    update: {},
    create: {
      user_id: demoAuthorUser.id,
      rut: "11.111.111-1",
      bio: "Autor de demostración para pruebas de BiblioChile",
      status: "aprobado",
      declaration_accepted: true,
    },
  });

  const demoBook = await prisma.book.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: "Obra de Demostración — BiblioChile",
      author_id: demoAuthor.id,
      is_free: false,
      content_url: "https://example.com/obra-demo.pdf",
      cover_url: null,
      description: "Libro de pago de ejemplo, para demostrar el flujo de suscripción y arriendo.",
    },
  });

  console.log("Autor de demo creado:", demoAuthorUser.email, "| Libro de pago:", demoBook.title, `(id: ${demoBook.id})`);

}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });