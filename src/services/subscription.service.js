import { prisma } from "../prisma/client.js";

const getPlans = async () => {
    const plans = await prisma.subscriptionPlan.findMany();
    return plans
}

const createSubscription = async (userId,planId) => {
    // Verificar si ya tienes una suscripcion activa
    const existing = await prisma.subscription.findFirst({
        where: {
            user_id: userId,
            status: "activa",
        },
    });
    if (existing) {
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

const getActiveSubscription = async (userId) => {
    const subscription = await prisma.subscription.findFirst({
        where: { user_id: userId, status: "activa" },
        include: {
            plan: true,
            _count: { select: { rentals: true } },
        },
    });

    if (!subscription) {
        return { active: false };
    }

    return {
        active: true,
        plan_name: subscription.plan.name,
        end_date: subscription.end_date,
        max_rentals: subscription.plan.max_rentals,
        rentals_used: subscription._count.rentals,
    };
};

export { getPlans, createSubscription, getActiveSubscription };