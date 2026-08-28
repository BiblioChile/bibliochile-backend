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

// Cambiar de plan mientras hay una suscripción vigente: sin prorrateo ni
// reembolso parcial (se pierden los días restantes de la anterior, mismo
// criterio que usan varias apps freemium al hacer upgrade/downgrade). Si no
// hay ninguna suscripción activa, se comporta igual que createSubscription
// (mismas validaciones, mismo 201) — no hay nada que "cambiar" en ese caso.
const changeSubscriptionPlan = async (userId, planId) => {
    // Verificar que el plan existe primero, mismo error que createSubscription.
    const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
    });

    if (!plan) {
        throw new Error("Plan no encontrado");
    }

    const existing = await prisma.subscription.findFirst({
        where: { user_id: userId, status: "activa" },
    });

    if (!existing) {
        const subscription = await createSubscription(userId, planId);
        return { subscription, changed: false };
    }

    // Cancelar la vigente antes de crear la nueva: nunca deben coexistir
    // dos suscripciones "activa" para el mismo usuario.
    await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: "cancelada" },
    });

    const start_date = new Date();
    const end_date = new Date();
    end_date.setDate(end_date.getDate() + plan.duration_days);

    const subscription = await prisma.subscription.create({
        data: {
            user_id: userId,
            plan_id: planId,
            start_date,
            end_date,
            status: "activa",
        },
    });

    return { subscription, changed: true };
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

export { getPlans, createSubscription, getActiveSubscription, changeSubscriptionPlan };