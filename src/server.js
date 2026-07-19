import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares globales
app.use(express.json())

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'BiblioChile API' })
})

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app