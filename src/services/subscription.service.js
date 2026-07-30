import { tr } from "zod/v4/locales";
import { prisma } from "../prisma/client.js";
import { error } from "node:console";

const getPlans = async () => {
    const plans = await prisma.subscriptionPlan.findMany();
    return plans
}

const createSubscription = async (userId,planId) => {
    console.log("1. Buscando suscripción activa...");

    // Verificar si ya tienes una suscripcion activa
    const existing = await prisma.subscription.findFirst({
        where: {
            user_id: userId,
            status: "activa",
        },
    });
    console.log("2. Resultado:", existing);
    if (existing) {
        console.log("2. Resultado: ", existing)
        throw new Error("Ya tienes una suscripción activa");
    }

    // Verificar que el plan existe
    const plan = await prisma.subscriptionPlan.findUnique({
        where: {id:planId},
    })

    if (!plan) {
        throw new Error("Plan no encontrado")
    }

    // Calcular Fechas

    const start_date = new Date();
    const end_date = new Date();
    end_date.setDate(end_date.getDate()+ plan.duration_days);

    // Crear suscripcion

    const subscription = await prisma.subscription.create({
        data: {
            user_id: userId,
            plan_id: planId,
            start_date,
            end_date,
            status: "activa"
        },
    });
    return subscription ;
};

export { getPlans, createSubscription };