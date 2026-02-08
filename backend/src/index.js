import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { log } from './logger.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// --- Request logging ---
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    log.req(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`)
  })
  next()
})

// --- Routes ---
app.use('/api', chatRouter)

app.listen(PORT, () => {
  console.log(`Parsec backend listening on port ${PORT}`)
})
