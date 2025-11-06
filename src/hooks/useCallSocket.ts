import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getCallSocketClient,
  resetCallSocketClient,
  type ConnectionStatus,
} from '@/lib/socket/callSocketClient'
import { type CallIncomingPayload, type CallActionPayload } from '@/types/socketEvents'

/**
 * Hook for managing Socket.IO connection and call events
 * Handles authentication, connection lifecycle, and event subscriptions
 */

interface UseCallSocketConfig {
  enabled?: boolean
  onIncomingCall?: (payload: CallIncomingPayload) => void
  onCallAccepted?: (payload: CallActionPayload) => void
  onCallDeclined?: (payload: CallActionPayload) => void
  onCallEnded?: (payload: CallActionPayload) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  onError?: (error: string) => void
}

interface UseCallSocketReturn {
  // State
  isConnected: boolean
  status: ConnectionStatus
  error: string | null

  // Methods
  initiateCall: (
    sessionId: string,
    callType: 'DIRECT' | 'GROUP',
    participantIds: string[],
    meetingInfo: { chimeMeetingId?: string; mediaPlacement?: Record<string, unknown> }
  ) => Promise<void>
  acceptCall: (sessionId: string) => Promise<void>
  declineCall: (sessionId: string) => Promise<void>
  endCall: (sessionId: string) => Promise<void>
  disconnect: () => void
  reconnect: () => Promise<void>
}

export function useCallSocket(config: UseCallSocketConfig = {}): UseCallSocketReturn {
  const { enabled = true, ...callbacks } = config

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef(getCallSocketClient())
  const connectionAttemptedRef = useRef(false)

  /**
   * Handle incoming call
   */
  const handleIncomingCall = useCallback(
    (payload: CallIncomingPayload) => {
      console.log('useCallSocket: Incoming call received', payload.sessionId)
      callbacks.onIncomingCall?.(payload)
    },
    [callbacks]
  )

  /**
   * Handle call accepted
   */
  const handleCallAccepted = useCallback(
    (payload: CallActionPayload) => {
      console.log('useCallSocket: Call accepted', payload.sessionId)
      callbacks.onCallAccepted?.(payload)
    },
    [callbacks]
  )

  /**
   * Handle call declined
   */
  const handleCallDeclined = useCallback(
    (payload: CallActionPayload) => {
      console.log('useCallSocket: Call declined', payload.sessionId)
      callbacks.onCallDeclined?.(payload)
    },
    [callbacks]
  )

  /**
   * Handle call ended
   */
  const handleCallEnded = useCallback(
    (payload: CallActionPayload) => {
      console.log('useCallSocket: Call ended', payload.sessionId)
      callbacks.onCallEnded?.(payload)
    },
    [callbacks]
  )

  /**
   * Handle connection status change
   */
  const handleConnectionChange = useCallback(
    (newStatus: ConnectionStatus) => {
      console.log('useCallSocket: Connection status changed', newStatus)
      setStatus(newStatus)
      setError(null)
      callbacks.onConnectionChange?.(newStatus)
    },
    [callbacks]
  )

  /**
   * Handle errors
   */
  const handleError = useCallback(
    (errorMessage: string) => {
      console.error('useCallSocket: Error', errorMessage)
      setError(errorMessage)
      callbacks.onError?.(errorMessage)
    },
    [callbacks]
  )

  /**
   * Connect to Socket.IO server
   */
  const connect = useCallback(async () => {
    if (connectionAttemptedRef.current) {
      console.warn('useCallSocket: Connection already attempted')
      return
    }

    connectionAttemptedRef.current = true

    try {
      await clientRef.current.connect({
        onIncomingCall: handleIncomingCall,
        onCallAccepted: handleCallAccepted,
        onCallDeclined: handleCallDeclined,
        onCallEnded: handleCallEnded,
        onConnectionChange: handleConnectionChange,
        onError: handleError,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect'
      setError(errorMessage)
      console.error('useCallSocket: Connection failed', err)
    }
  }, [
    handleIncomingCall,
    handleCallAccepted,
    handleCallDeclined,
    handleCallEnded,
    handleConnectionChange,
    handleError,
  ])

  /**
   * Disconnect from Socket.IO server
   */
  const disconnect = useCallback(() => {
    console.log('useCallSocket: Disconnecting')
    clientRef.current.disconnect()
    setStatus('disconnected')
    setError(null)
    connectionAttemptedRef.current = false
  }, [])

  /**
   * Reconnect to Socket.IO server
   */
  const reconnect = useCallback(async () => {
    console.log('useCallSocket: Reconnecting')
    disconnect()
    connectionAttemptedRef.current = false

    // Small delay before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 500))

    return connect()
  }, [connect, disconnect])

  /**
   * Initiate a call
   */
  const initiateCall = useCallback(
    async (
      sessionId: string,
      callType: 'DIRECT' | 'GROUP',
      participantIds: string[],
      meetingInfo: { chimeMeetingId?: string; mediaPlacement?: Record<string, unknown> }
    ) => {
      try {
        if (!clientRef.current.isConnected()) {
          throw new Error('Socket not connected. Please try again.')
        }

        await clientRef.current.initiateCall(sessionId, callType, participantIds, meetingInfo)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initiate call'
        setError(errorMessage)
        throw err
      }
    },
    []
  )

  /**
   * Accept a call
   */
  const acceptCall = useCallback(async (sessionId: string) => {
    try {
      if (!clientRef.current.isConnected()) {
        throw new Error('Socket not connected. Please try again.')
      }

      await clientRef.current.acceptCall(sessionId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept call'
      setError(errorMessage)
      throw err
    }
  }, [])

  /**
   * Decline a call
   */
  const declineCall = useCallback(async (sessionId: string) => {
    try {
      if (!clientRef.current.isConnected()) {
        throw new Error('Socket not connected. Please try again.')
      }

      await clientRef.current.declineCall(sessionId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decline call'
      setError(errorMessage)
      throw err
    }
  }, [])

  /**
   * End a call
   */
  const endCall = useCallback(async (sessionId: string) => {
    try {
      if (!clientRef.current.isConnected()) {
        throw new Error('Socket not connected. Please try again.')
      }

      await clientRef.current.endCall(sessionId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end call'
      setError(errorMessage)
      throw err
    }
  }, [])

  /**
   * Effect: Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    if (!enabled) {
      console.log('useCallSocket: Disabled, skipping connection')
      return
    }

    console.log('useCallSocket: Mounting, attempting connection')
    connect()

    return () => {
      console.log('useCallSocket: Unmounting, disconnecting')
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected: clientRef.current.isConnected(),
    status,
    error,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    disconnect,
    reconnect,
  }
}
