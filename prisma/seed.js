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
  const hashedPassword = await bcrypt.hash("admin1234", 10);

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