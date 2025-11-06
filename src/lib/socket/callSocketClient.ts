'use client'

import { io, Socket } from 'socket.io-client'
import { fetchAuthSession } from 'aws-amplify/auth'
import {
  CallIncomingPayload,
  CallActionPayload,
  SocketSuccessResponse,
  SocketErrorResponse,
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '@/types/socketEvents'

/**
 * Socket.IO Client for Call Signaling
 * Handles real-time call notifications with Cognito JWT authentication
 */

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface CallSocketClientConfig {
  url?: string
  reconnection?: boolean
  reconnectionDelay?: number
  reconnectionDelayMax?: number
  reconnectionAttempts?: number
}

interface CallSocketCallbacks {
  onIncomingCall?: (payload: CallIncomingPayload) => void
  onCallAccepted?: (payload: CallActionPayload) => void
  onCallDeclined?: (payload: CallActionPayload) => void
  onCallEnded?: (payload: CallActionPayload) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  onError?: (error: string) => void
}

class CallSocketClient {
  private socket: Socket | null = null
  private connectionStatus: ConnectionStatus = 'disconnected'
  private idToken: string | null = null
  private callbacks: CallSocketCallbacks = {}
  private config: Required<CallSocketClientConfig>
  private tokenRefreshTimer: NodeJS.Timeout | null = null

  constructor(config?: CallSocketClientConfig) {
    this.config = {
      url: config?.url || process.env.NEXT_PUBLIC_SOCKET_URL || '/api/calls/socket',
      reconnection: config?.reconnection !== false,
      reconnectionDelay: config?.reconnectionDelay || 1000,
      reconnectionDelayMax: config?.reconnectionDelayMax || 5000,
      reconnectionAttempts: config?.reconnectionAttempts || 5,
    }
  }

  /**
   * Get Cognito ID token from current auth session
   */
  private async getIdToken(): Promise<string> {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      if (!token) {
        throw new Error('No ID token available. User may not be authenticated.')
      }

      this.idToken = token
      return token
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to retrieve ID token'
      this.handleError(errorMessage)
      throw error
    }
  }

  /**
   * Connect to Socket.IO server with JWT authentication
   */
  async connect(callbacks?: CallSocketCallbacks): Promise<void> {
    if (this.socket?.connected) {
      console.warn('Socket already connected')
      return
    }

    try {
      this.setStatus('connecting')

      if (callbacks) {
        this.callbacks = callbacks
      }

      // Get ID token before connecting
      const idToken = await this.getIdToken()

      // Create Socket.IO connection with auth
      this.socket = io(this.config.url, {
        auth: {
          token: idToken,
        },
        reconnection: this.config.reconnection,
        reconnectionDelay: this.config.reconnectionDelay,
        reconnectionDelayMax: this.config.reconnectionDelayMax,
        reconnectionAttempts: this.config.reconnectionAttempts,
        transports: ['websocket', 'polling'],
      })

      // Set up event listeners
      this.setupEventListeners()

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        this.socket!.on('connect', () => {
          resolve()
        })
        this.socket!.on('connect_error', (error) => {
          reject(error)
        })

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      })

      this.setStatus('connected')
      console.log('Socket.IO client connected:', this.socket.id)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to connect to Socket.IO server'
      this.handleError(errorMessage)
      this.setStatus('error')
      throw error
    }
  }

  /**
   * Set up Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('[Socket.IO] Connected')
      this.setStatus('connected')
    })

    this.socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected')
      this.setStatus('disconnected')
    })

    this.socket.on('reconnect', () => {
      console.log('[Socket.IO] Reconnected')
      this.setStatus('connected')
      // Refresh token on reconnect
      this.refreshTokenOnReconnect()
    })

    this.socket.on('reconnect_attempt', () => {
      console.log('[Socket.IO] Reconnecting...')
      this.setStatus('reconnecting')
    })

    this.socket.on('connect_error', (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[Socket.IO] Connection error:', errorMessage)

      // Handle authentication errors
      if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
        this.handleAuthenticationError()
      } else {
        this.handleError(errorMessage)
      }

      this.setStatus('error')
    })

    // Call events
    this.socket.on(SERVER_EVENTS.CALL_INCOMING, (payload: CallIncomingPayload) => {
      console.log('[Socket.IO] Incoming call:', payload.sessionId)
      this.callbacks.onIncomingCall?.(payload)
    })

    this.socket.on(SERVER_EVENTS.CALL_ACCEPTED, (payload: CallActionPayload) => {
      console.log('[Socket.IO] Call accepted by:', payload.userId)
      this.callbacks.onCallAccepted?.(payload)
    })

    this.socket.on(SERVER_EVENTS.CALL_DECLINED, (payload: CallActionPayload) => {
      console.log('[Socket.IO] Call declined by:', payload.userId)
      this.callbacks.onCallDeclined?.(payload)
    })

    this.socket.on(SERVER_EVENTS.CALL_ENDED, (payload: CallActionPayload) => {
      console.log('[Socket.IO] Call ended by:', payload.userId)
      this.callbacks.onCallEnded?.(payload)
    })

    this.socket.on(SERVER_EVENTS.CALL_ERROR, (error: SocketErrorResponse) => {
      console.error('[Socket.IO] Call error:', error.message)
      this.handleError(error.message)
    })

    // Generic error event
    this.socket.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[Socket.IO] Error:', errorMessage)
      this.handleError(errorMessage)
    })
  }

  /**
   * Emit call initiation event with acknowledgment
   */
  async initiateCall(
    sessionId: string,
    callType: 'DIRECT' | 'GROUP',
    participantIds: string[],
    meetingInfo: { chimeMeetingId?: string; mediaPlacement?: Record<string, unknown> }
  ): Promise<SocketSuccessResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const payload = {
        sessionId,
        callType,
        participantIds,
        meetingInfo,
      }

      this.socket.emit(
        CLIENT_EVENTS.CALL_INITIATE,
        payload,
        (response: SocketSuccessResponse | SocketErrorResponse) => {
          if (response.success) {
            console.log('[Socket.IO] Call initiated:', sessionId)
            resolve(response as SocketSuccessResponse)
          } else {
            const error = response as SocketErrorResponse
            console.error('[Socket.IO] Call initiation failed:', error.message)
            reject(new Error(error.message))
          }
        }
      )
    })
  }

  /**
   * Emit call acceptance event with acknowledgment
   */
  async acceptCall(sessionId: string): Promise<SocketSuccessResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const payload = { sessionId }

      this.socket.emit(
        CLIENT_EVENTS.CALL_ACCEPT,
        payload,
        (response: SocketSuccessResponse | SocketErrorResponse) => {
          if (response.success) {
            console.log('[Socket.IO] Call accepted:', sessionId)
            resolve(response as SocketSuccessResponse)
          } else {
            const error = response as SocketErrorResponse
            console.error('[Socket.IO] Call acceptance failed:', error.message)
            reject(new Error(error.message))
          }
        }
      )
    })
  }

  /**
   * Emit call decline event with acknowledgment
   */
  async declineCall(sessionId: string): Promise<SocketSuccessResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const payload = { sessionId }

      this.socket.emit(
        CLIENT_EVENTS.CALL_DECLINE,
        payload,
        (response: SocketSuccessResponse | SocketErrorResponse) => {
          if (response.success) {
            console.log('[Socket.IO] Call declined:', sessionId)
            resolve(response as SocketSuccessResponse)
          } else {
            const error = response as SocketErrorResponse
            console.error('[Socket.IO] Call decline failed:', error.message)
            reject(new Error(error.message))
          }
        }
      )
    })
  }

  /**
   * Emit call end event with acknowledgment
   */
  async endCall(sessionId: string): Promise<SocketSuccessResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const payload = { sessionId }

      this.socket.emit(
        CLIENT_EVENTS.CALL_END,
        payload,
        (response: SocketSuccessResponse | SocketErrorResponse) => {
          if (response.success) {
            console.log('[Socket.IO] Call ended:', sessionId)
            resolve(response as SocketSuccessResponse)
          } else {
            const error = response as SocketErrorResponse
            console.error('[Socket.IO] Call end failed:', error.message)
            reject(new Error(error.message))
          }
        }
      )
    })
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.socket?.connected === true
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer)
      this.tokenRefreshTimer = null
    }

    if (this.socket?.connected) {
      this.socket.disconnect()
      console.log('[Socket.IO] Disconnected')
    }

    this.setStatus('disconnected')
  }

  /**
   * Handle connection status change
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      console.log(`[Socket.IO] Status changed: ${status}`)
      this.callbacks.onConnectionChange?.(status)
    }
  }

  /**
   * Handle generic errors
   */
  private handleError(message: string): void {
    console.error('[Socket.IO] Error:', message)
    this.callbacks.onError?.(message)
  }

  /**
   * Handle authentication errors - trigger logout
   */
  private handleAuthenticationError(): void {
    const message = 'Authentication error: Please log in again'
    console.error('[Socket.IO]', message)
    this.handleError(message)
    // Dispatch logout event or call logout function
    // This will be handled by the component using this client
  }

  /**
   * Refresh token on reconnection
   */
  private async refreshTokenOnReconnect(): Promise<void> {
    try {
      const newToken = await this.getIdToken()
      if (this.socket) {
        // Socket.IO doesn't directly support updating auth after connection
        // The token refresh happens automatically on next connection attempt
        console.log('[Socket.IO] Token refreshed on reconnect')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to refresh token'
      console.error('[Socket.IO] Token refresh failed:', errorMessage)
      this.handleAuthenticationError()
    }
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket
  }
}

// Singleton instance
let instance: CallSocketClient | null = null

/**
 * Get or create the singleton CallSocketClient instance
 */
export function getCallSocketClient(config?: CallSocketClientConfig): CallSocketClient {
  if (!instance) {
    instance = new CallSocketClient(config)
  }
  return instance
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCallSocketClient(): void {
  instance?.disconnect()
  instance = null
}

export type { ConnectionStatus, CallSocketCallbacks, CallSocketClientConfig }
export { CallSocketClient }