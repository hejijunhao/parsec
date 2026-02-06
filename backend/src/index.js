import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// --- Routes ---
app.use('/api', chatRouter)

app.listen(PORT, () => {
  console.log(`Parsec backend listening on port ${PORT}`)
})
