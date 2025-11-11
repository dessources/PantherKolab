/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);

dotenv.config({ path: envPath });

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'
import { messageService } from './src/services/messageService.js'
import { conversationService } from './src/services/conversationService.js'
import { authenticateSocket, getAuthenticatedUserId } from './src/lib/socket/socketAuthMiddleware.js'

declare global {
  // attach io to global to allow access throughout the app
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var io: Server | undefined
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  global.io = io

  // Apply authentication middleware to all connections
  io.use(authenticateSocket)

  io.on('connection', (socket) => {
    const userId = getAuthenticatedUserId(socket)
    console.log(`✅ Client connected: ${socket.id} (user: ${userId})`)

    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId)
      console.log(`${socket.id} joined ${conversationId}`)
    })

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId)
      console.log(`${socket.id} left ${conversationId}`)
    })

    socket.on('send-message', async (data, callback) => {
      try {
        const { conversationId, content, type, tempId } = data

        // Get authenticated userId from socket (don't trust client's senderId)
        const authenticatedUserId = getAuthenticatedUserId(socket)

        if (!authenticatedUserId) {
          callback?.({ success: false, error: 'Unauthorized: No authenticated user' })
          return
        }

        // 1. Send message directly through backend logic (no fetch)
        const message = await messageService.sendMessage({
          conversationId,
          senderId: authenticatedUserId, // Use authenticated userId
          content,
          type: type || 'TEXT',
        })

        // 2. Update last message timestamp
        await conversationService.updateLastMessage(conversationId, message.timestamp)

        // 3. Broadcast to all clients in the room
        io.to(conversationId).emit('new-message', message)

        // 4. Acknowledge to sender
        callback?.({ success: true, messageId: message.messageId, tempId })
      } catch (error) {
        console.error('Send message error:', error)
        if (error instanceof Error) {
          callback?.({ success: false, error: error.message })
        } else {
          callback?.({ success: false, error: String(error) })
        }
      }
    })

    socket.on('typing-start', (data) => {
      const authenticatedUserId = getAuthenticatedUserId(socket)
      if (!authenticatedUserId) return

      // Broadcast with authenticated userId (don't trust client's userId)
      socket.to(data.conversationId).emit('user-typing', {
        userId: authenticatedUserId,
        conversationId: data.conversationId,
      })
    })

    socket.on('typing-stop', (data) => {
      const authenticatedUserId = getAuthenticatedUserId(socket)
      if (!authenticatedUserId) return

      // Broadcast with authenticated userId (don't trust client's userId)
      socket.to(data.conversationId).emit('user-stopped-typing', {
        userId: authenticatedUserId,
        conversationId: data.conversationId,
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log('> Socket.IO initialized')
  })

  server.on('error', (err: any) => {
    console.error('Server error:', err)
    process.exit(1)
  })
})
