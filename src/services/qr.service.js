import { prisma } from "../prisma/client.js"

const getQRByCode = async (code) => {
    const qr = await prisma.qRCode.findUnique({
        where: { code },
    });
    if (!qr) {
        throw new Error("QR no encontrado");
    }

    if (!qr.is_active) {
        throw new Error("QR inactivo");
    }

    return qr;
};

export { getQRByCode };
