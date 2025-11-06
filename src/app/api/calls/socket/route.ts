import { Server as SocketIOServer, Socket } from 'socket.io'
import { NextRequest, NextResponse } from 'next/server'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { parameterStore } from '@/lib/parameterStore'
import {
  registerUserSocket,
  getSocketIdForUser,
  storeCallSession,
  getCallSession,
  removeCallSession,
  addParticipantToCall,
  broadcastToCallParticipants,
  cleanupUserOnDisconnect,
  getTimestamp,
} from '@/lib/socket/socketUtils'
import {
  CallSessionState,
  CallInitiatePayload,
  CallIncomingPayload,
  CallActionPayload,
  SocketErrorResponse,
  SocketSuccessResponse,
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '@/types/socketEvents'

/**
 * Global Socket.IO server instance
 */
let io: SocketIOServer | null = null
let verifierPromise: Promise<ReturnType<typeof CognitoJwtVerifier.create>> | null = null

/**
 * Initialize Cognito JWT verifier for Socket.IO authentication
 */
async function getSocketVerifier(): Promise<ReturnType<typeof CognitoJwtVerifier.create>> {
  if (verifierPromise) {
    return verifierPromise
  }

  verifierPromise = (async () => {
    try {
      const config = await parameterStore.getParameters([
        'cognito/user-pool-id',
        'cognito/client-id',
      ])

      const userPoolId = config['cognito/user-pool-id']
      const clientId = config['cognito/client-id']

      if (!userPoolId || !clientId) {
        throw new Error(
          'Missing required Cognito parameters for Socket.IO: cognito/user-pool-id and cognito/client-id'
        )
      }

      return CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: 'id',
      })
    } catch (error) {
      verifierPromise = null
      throw error
    }
  })()

  return verifierPromise
}

/**
 * Initialize Socket.IO server with authentication
 */
async function initializeSocketIOServer(): Promise<SocketIOServer> {
  if (io) {
    return io
  }

  const verifier = await getSocketVerifier()

  // Create Socket.IO server with CORS and authentication
  io = new SocketIOServer({
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      // Verify JWT token
      const payload = await verifier.verify(token)
      const userId = payload.sub

      if (!userId) {
        return next(new Error('Authentication error: Invalid token'))
      }

      // Attach userId to socket
      socket.data.userId = userId
      next()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      next(new Error(`Authentication error: ${errorMessage}`))
    }
  })

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string

    console.log(`[Socket.IO] User connected: ${userId} (socket: ${socket.id})`)

    // Register user-socket mapping
    registerUserSocket(userId, socket.id)

    // Emit successful connection
    socket.emit(SERVER_EVENTS.CALL_ACCEPTED, {
      success: true,
      message: 'Connected to call server',
      timestamp: getTimestamp(),
    } as SocketSuccessResponse)

    // ====== EVENT HANDLERS ======

    /**
     * Handle incoming call initiation (DIRECT or GROUP)
     * Client sends: { sessionId, callType, participantIds, meetingInfo }
     */
    socket.on(CLIENT_EVENTS.CALL_INITIATE, async (payload: CallInitiatePayload, ack?: (response: SocketSuccessResponse | SocketErrorResponse) => void) => {
      try {
        const { sessionId, callType, participantIds, meetingInfo } = payload

        console.log(`[Socket.IO] Call initiate: ${userId} initiates ${callType} call to ${participantIds.join(', ')} (session: ${sessionId})`)

        // Validate payload
        if (!sessionId || !callType || !participantIds || participantIds.length === 0 || !meetingInfo) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'INVALID_PAYLOAD',
            message: 'Missing required fields: sessionId, callType (DIRECT|GROUP), participantIds (non-empty array), meetingInfo',
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Validate callType
        if (!['DIRECT', 'GROUP'].includes(callType)) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'INVALID_CALL_TYPE',
            message: 'callType must be DIRECT or GROUP',
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Validate DIRECT calls have exactly 1 other participant
        if (callType === 'DIRECT' && participantIds.length !== 1) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'INVALID_PARTICIPANTS',
            message: 'DIRECT calls must have exactly 1 other participant',
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Create call session
        const callSession: CallSessionState = {
          sessionId,
          initiatorId: userId,
          initiatorSocketId: socket.id,
          recipientIds: participantIds,
          participantSocketMap: new Map([[userId, socket.id]]),
          meetingInfo,
          startedAt: getTimestamp(),
          status: 'RINGING',
        }

        // Store session in memory
        storeCallSession(callSession)

        // Send acknowledgment to initiator
        ack?.({
          success: true,
          message: 'Call initiation sent',
          timestamp: getTimestamp(),
        })

        // Emit incoming call notification to all recipients
        const incomingPayload: CallIncomingPayload = {
          sessionId,
          initiatorId: userId,
          callType,
          participantIds,
          meetingInfo,
          timestamp: getTimestamp(),
        }

        // Send to each recipient (not to initiator)
        participantIds.forEach(recipientId => {
          const recipientSocketId = getSocketIdForUser(recipientId)
          if (recipientSocketId) {
            io!.to(recipientSocketId).emit(SERVER_EVENTS.CALL_INCOMING, incomingPayload)
          }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Socket.IO] Error in call:initiate:`, error)
        ack?.({
          success: false,
          code: 'CALL_INITIATE_ERROR',
          message: errorMessage,
          timestamp: getTimestamp(),
        })
      }
    })

    /**
     * Handle call acceptance
     * Client sends: { sessionId }
     */
    socket.on(CLIENT_EVENTS.CALL_ACCEPT, async (payload: { sessionId: string }, ack?: (response: SocketSuccessResponse | SocketErrorResponse) => void) => {
      try {
        const { sessionId } = payload

        console.log(`[Socket.IO] Call accept: ${userId} (session: ${sessionId})`)

        // Validate session exists
        const session = getCallSession(sessionId)
        if (!session) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'SESSION_NOT_FOUND',
            message: `Call session not found: ${sessionId}`,
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Add participant to call
        addParticipantToCall(sessionId, userId, socket.id)

        // Send acknowledgment to accepter
        ack?.({
          success: true,
          message: 'Call accepted',
          timestamp: getTimestamp(),
        })

        // Broadcast acceptance to all participants
        const acceptedPayload: CallActionPayload = {
          sessionId,
          userId,
          timestamp: getTimestamp(),
        }

        broadcastToCallParticipants(
          io!,
          sessionId,
          SERVER_EVENTS.CALL_ACCEPTED,
          acceptedPayload
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Socket.IO] Error in call:accept:`, error)
        ack?.({
          success: false,
          code: 'CALL_ACCEPT_ERROR',
          message: errorMessage,
          timestamp: getTimestamp(),
        })
      }
    })

    /**
     * Handle call decline
     * Client sends: { sessionId }
     */
    socket.on(CLIENT_EVENTS.CALL_DECLINE, async (payload: { sessionId: string }, ack?: (response: SocketSuccessResponse | SocketErrorResponse) => void) => {
      try {
        const { sessionId } = payload

        console.log(`[Socket.IO] Call decline: ${userId} (session: ${sessionId})`)

        // Validate session exists
        const session = getCallSession(sessionId)
        if (!session) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'SESSION_NOT_FOUND',
            message: `Call session not found: ${sessionId}`,
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Send acknowledgment to decliner
        ack?.({
          success: true,
          message: 'Call declined',
          timestamp: getTimestamp(),
        })

        // Broadcast decline to all participants
        const declinedPayload: CallActionPayload = {
          sessionId,
          userId,
          timestamp: getTimestamp(),
        }

        broadcastToCallParticipants(
          io!,
          sessionId,
          SERVER_EVENTS.CALL_DECLINED,
          declinedPayload
        )

        // Clean up session
        removeCallSession(sessionId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Socket.IO] Error in call:decline:`, error)
        ack?.({
          success: false,
          code: 'CALL_DECLINE_ERROR',
          message: errorMessage,
          timestamp: getTimestamp(),
        })
      }
    })

    /**
     * Handle call end
     * Client sends: { sessionId }
     */
    socket.on(CLIENT_EVENTS.CALL_END, async (payload: { sessionId: string }, ack?: (response: SocketSuccessResponse | SocketErrorResponse) => void) => {
      try {
        const { sessionId } = payload

        console.log(`[Socket.IO] Call end: ${userId} (session: ${sessionId})`)

        // Validate session exists
        const session = getCallSession(sessionId)
        if (!session) {
          const error: SocketErrorResponse = {
            success: false,
            code: 'SESSION_NOT_FOUND',
            message: `Call session not found: ${sessionId}`,
            timestamp: getTimestamp(),
          }
          ack?.(error)
          return
        }

        // Send acknowledgment to ender
        ack?.({
          success: true,
          message: 'Call ended',
          timestamp: getTimestamp(),
        })

        // Broadcast end to all participants
        const endedPayload: CallActionPayload = {
          sessionId,
          userId,
          timestamp: getTimestamp(),
        }

        broadcastToCallParticipants(
          io!,
          sessionId,
          SERVER_EVENTS.CALL_ENDED,
          endedPayload
        )

        // Clean up session
        removeCallSession(sessionId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Socket.IO] Error in call:end:`, error)
        ack?.({
          success: false,
          code: 'CALL_END_ERROR',
          message: errorMessage,
          timestamp: getTimestamp(),
        })
      }
    })

    // Disconnection handler
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User disconnected: ${userId} (socket: ${socket.id})`)

      // Clean up user and active calls
      cleanupUserOnDisconnect(socket)
    })

    // Error handler
    socket.on('error', (error: Error) => {
      console.error(`[Socket.IO] Socket error for ${userId}:`, error)
    })
  })

  return io
}

/**
 * WebSocket upgrade handler for Next.js
 * Handles Socket.IO connection upgrade
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await initializeSocketIOServer()

    // Return response for WebSocket upgrade
    return new NextResponse('WebSocket server running', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  } catch (error) {
    console.error('[Socket.IO] Initialization error:', error)
    return new NextResponse(
      JSON.stringify({
        error: 'Failed to initialize Socket.IO server',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Export Socket.IO server instance for use in other modules
 */
export function getSocketIOServer(): SocketIOServer | null {
  return io
}
