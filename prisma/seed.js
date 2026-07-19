import "dotenv/config";
import { Pool } from "node:pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";
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