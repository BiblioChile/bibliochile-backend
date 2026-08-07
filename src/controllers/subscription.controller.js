//import { setServers } from "dns";
import { getPlans, createSubscription, getActiveSubscription as getActiveSubscriptionService } from "../services/subscription.service.js";

const listPlans = async (req, res) => {
    try{
        const plans = await getPlans();
        res.status(200).json(plans)
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const subscribe = async (req, res) => {

    try {
        const { planId }  = req.body;
        const userId = req.user.id;
        
        const subscription = await createSubscription(userId, planId);
        res.status(201).json(subscription);
    } catch (error) {
        if (error.message === "Ya tienes una suscripción activa" ) {
            return res.status(409).json({message: error.message});
        }
        if (error.message === "Plan no encontrado" ) {
            return res.status(404).json({message: error.message});
        }
        res.status(500).json({ message: error.message });
    }
};

const getActiveSubscription = async (req, res) => {
    try {
        const result = await getActiveSubscriptionService(req.user.id);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export { listPlans, subscribe, getActiveSubscription};