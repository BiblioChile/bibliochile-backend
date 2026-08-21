import express from 'express';
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import bookRoutes from "./routes/book.routes.js";
import qrRoutes from "./routes/qr.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js"
import progressRoutes from "./routes/progress.routes.js"
import rentalRoutes from "./routes/rental.routes.js"
import authorRoutes from "./routes/author.routes.js"

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares globales
const allowedOrigins = [
  "http://localhost:4173", // preview build (vite preview)
  "http://localhost:5173", // dev server (vite dev)
  // TODO: agregar acá el dominio real de producción del frontend (Vercel) cuando exista
];

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin (curl, apps móviles, health checks) se permite
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("No permitido por CORS"));
  },
}));
app.use(express.json())

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/authors", authorRoutes);

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'BiblioChile API' })
})

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app