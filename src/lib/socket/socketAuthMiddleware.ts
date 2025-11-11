/**
 * Socket.IO Authentication Middleware for AWS Cognito
 *
 * This middleware verifies Cognito JWT tokens for Socket.IO connections.
 * Clients must provide a valid Cognito access token when connecting.
 *
 * Usage:
 * - Client sends token in handshake: socket.io({ auth: { token: accessToken } })
 * - Server verifies token using CognitoJwtVerifier
 * - If valid, userId is attached to socket.data.userId
 * - If invalid, connection is rejected
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { Socket } from 'socket.io'

// Cache verifier to avoid recreating on every connection
let cachedVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null

/**
 * Get or create Cognito JWT Verifier
 * Uses environment variables for Cognito configuration
 */
function getVerifier() {
  if (cachedVerifier) {
    return cachedVerifier
  }

  try {
    // Get Cognito config from environment variables (loaded by dotenv in server.ts)
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID

    if (!userPoolId || !clientId) {
      throw new Error(
        'Missing Cognito configuration. Ensure NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID are set in .env.local'
      )
    }

    // Create verifier for access tokens
    cachedVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access', // Using access token (not id token)
      clientId,
    })

    console.log('✅ Socket.IO JWT verifier initialized')
    console.log(`   User Pool ID: ${userPoolId}`)
    console.log(`   Client ID: ${clientId}`)
    return cachedVerifier
  } catch (error) {
    console.error('❌ Failed to initialize JWT verifier:', error)
    throw error
  }
}

/**
 * Socket.IO Authentication Middleware
 *
 * Verifies Cognito JWT token and attaches userId to socket.data
 *
 * @param socket - Socket.IO socket instance
 * @param next - Next middleware function
 */
export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    // Get token from handshake auth
    const token = socket.handshake.auth?.token

    if (!token) {
      console.warn(`⚠️ Socket connection rejected: No token provided (socket: ${socket.id})`)
      return next(new Error('Authentication error: No token provided'))
    }

    // Verify token with Cognito
    const verifier = getVerifier()
    const payload = await verifier.verify(token)

    // Extract userId from token payload
    // Cognito access tokens have 'sub' claim which is the userId
    const userId = payload.sub

    if (!userId) {
      console.warn(`⚠️ Socket connection rejected: Invalid token payload (socket: ${socket.id})`)
      return next(new Error('Authentication error: Invalid token'))
    }

    // Attach userId to socket data for use in event handlers
    socket.data.userId = userId
    socket.data.username = payload.username || 'unknown'

    console.log(`✅ Socket authenticated: ${socket.id} (user: ${userId})`)

    // Continue to next middleware
    next()
  } catch (error) {
    // Token verification failed
    console.error(`❌ Socket authentication failed (${socket.id}):`, error)

    if (error instanceof Error) {
      return next(new Error(`Authentication error: ${error.message}`))
    }

    return next(new Error('Authentication error: Invalid or expired token'))
  }
}

/**
 * Helper function to get authenticated userId from socket
 * Use this in event handlers to ensure userId is available
 *
 * @param socket - Socket.IO socket instance
 * @returns userId if authenticated, null otherwise
 */
export function getAuthenticatedUserId(socket: Socket): string | null {
  return socket.data.userId || null
}

/**
 * Reset the cached verifier (useful for testing)
 */
export function resetVerifier() {
  cachedVerifier = null
}
