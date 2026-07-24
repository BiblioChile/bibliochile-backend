import express from 'express';
import cors from "cors";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares globales
app.use(cors());
app.use(express.json())

// Rutas
app.use("/api/auth", authRoutes);

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'BiblioChile API' })
})

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app