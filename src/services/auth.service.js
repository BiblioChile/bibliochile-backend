import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";

const register = async ({ name, email, password, role }) => {
    // Verificar si el email ya existe
    const existing = await prisma.user.findUnique({
        where: { email },
    });

    if (existing) {
        throw new Error("El email ya está registrado");
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario
    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: role ?? "pasajero",
        },
    });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
};

const login = async ({ email, password }) => {
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new Error("Credenciales inválidas");
    }

    // Comparar la contraseña
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
        throw new Error("Credenciales inválidas");
    }

    // Generar el token JWT
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    };
};

export { register, login };