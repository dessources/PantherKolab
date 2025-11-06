'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CallIncomingPayload, CallActionPayload } from '@/types/socketEvents'

/**
 * Call state management context
 * Tracks active call, incoming calls, and call-related state
 */

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended'

export interface ActiveCall {
  sessionId: string
  callType: 'DIRECT' | 'GROUP'
  initiatorId: string
  initiatorName?: string
  participantIds: string[]
  participantNames?: Record<string, string>
  status: CallStatus
  meetingInfo?: {
    chimeMeetingId?: string
    mediaPlacement?: Record<string, unknown>
  }
  startedAt?: Date
  localVideoRef?: React.RefObject<HTMLVideoElement>
  remoteVideoRefs?: React.RefObject<HTMLVideoElement>[]
}

export interface IncomingCall {
  sessionId: string
  initiatorId: string
  initiatorName?: string
  callType: 'DIRECT' | 'GROUP'
  participantIds: string[]
  meetingInfo?: {
    chimeMeetingId?: string
    mediaPlacement?: Record<string, unknown>
  }
  timestamp: string
}

interface CallContextType {
  // State
  activeCall: ActiveCall | null
  incomingCall: IncomingCall | null
  callHistory: ActiveCall[]
  isMuted: boolean
  isCameraOn: boolean
  isLoading: boolean
  error: string | null

  // Call actions
  initiateCall: (
    callType: 'DIRECT' | 'GROUP',
    participantIds: string[],
    participantNames?: Record<string, string>,
    meetingInfo?: { chimeMeetingId?: string; mediaPlacement?: Record<string, unknown> }
  ) => Promise<string> // Returns sessionId
  acceptCall: (sessionId: string) => Promise<void>
  declineCall: (sessionId: string) => Promise<void>
  endCall: (sessionId: string) => Promise<void>

  // Audio/video controls
  toggleMute: (isMuted: boolean) => void
  toggleCamera: (isCameraOn: boolean) => void

  // Call state updates
  setIncomingCall: (call: IncomingCall | null) => void
  setActiveCall: (call: ActiveCall | null) => void
  updateCallStatus: (sessionId: string, status: CallStatus) => void
  addCallToHistory: (call: ActiveCall) => void
  clearError: () => void
  setError: (error: string | null) => void
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [callHistory, setCallHistory] = useState<ActiveCall[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initiate a new call
   */
  const initiateCall = useCallback(
    async (
      callType: 'DIRECT' | 'GROUP',
      participantIds: string[],
      participantNames?: Record<string, string>,
      meetingInfo?: { chimeMeetingId?: string; mediaPlacement?: Record<string, unknown> }
    ): Promise<string> => {
      try {
        setIsLoading(true)
        setError(null)

        // Generate sessionId
        const sessionId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Create active call object
        const newCall: ActiveCall = {
          sessionId,
          callType,
          initiatorId: 'current-user', // Will be set by caller
          participantIds,
          participantNames,
          status: 'ringing',
          meetingInfo,
          startedAt: new Date(),
        }

        setActiveCall(newCall)
        setIsLoading(false)

        return sessionId
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initiate call'
        setError(errorMessage)
        setIsLoading(false)
        throw err
      }
    },
    []
  )

  /**
   * Accept incoming call
   */
  const acceptCall = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      if (!incomingCall || incomingCall.sessionId !== sessionId) {
        throw new Error('Invalid incoming call')
      }

      // Convert incoming call to active call
      const newActiveCall: ActiveCall = {
        sessionId,
        callType: incomingCall.callType,
        initiatorId: incomingCall.initiatorId,
        initiatorName: incomingCall.initiatorName,
        participantIds: incomingCall.participantIds,
        status: 'connecting',
        meetingInfo: incomingCall.meetingInfo,
        startedAt: new Date(),
      }

      setActiveCall(newActiveCall)
      setIncomingCall(null)
      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept call'
      setError(errorMessage)
      setIsLoading(false)
      throw err
    }
  }, [incomingCall])

  /**
   * Decline incoming call
   */
  const declineCall = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      if (incomingCall?.sessionId === sessionId) {
        setIncomingCall(null)
      }

      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decline call'
      setError(errorMessage)
      setIsLoading(false)
      throw err
    }
  }, [incomingCall])

  /**
   * End active call
   */
  const endCall = useCallback(async (sessionId: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      if (activeCall?.sessionId === sessionId) {
        // Add to history
        const endedCall = {
          ...activeCall,
          status: 'ended' as CallStatus,
        }
        setCallHistory((prev) => [...prev, endedCall])

        // Clear active call
        setActiveCall(null)
      }

      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end call'
      setError(errorMessage)
      setIsLoading(false)
      throw err
    }
  }, [activeCall])

  /**
   * Toggle mute
   */
  const toggleMute = useCallback((muted: boolean): void => {
    setIsMuted(muted)
  }, [])

  /**
   * Toggle camera
   */
  const toggleCamera = useCallback((cameraOn: boolean): void => {
    setIsCameraOn(cameraOn)
  }, [])

  /**
   * Update call status
   */
  const updateCallStatus = useCallback((sessionId: string, status: CallStatus): void => {
    setActiveCall((prev) => {
      if (prev?.sessionId === sessionId) {
        return { ...prev, status }
      }
      return prev
    })
  }, [])

  /**
   * Add call to history
   */
  const addCallToHistory = useCallback((call: ActiveCall): void => {
    setCallHistory((prev) => [...prev, call])
  }, [])

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  const value: CallContextType = {
    // State
    activeCall,
    incomingCall,
    callHistory,
    isMuted,
    isCameraOn,
    isLoading,
    error,

    // Methods
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    setIncomingCall,
    setActiveCall,
    updateCallStatus,
    addCallToHistory,
    clearError,
    setError,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

/**
 * Hook to use call context
 */
export function useCallContext(): CallContextType {
  const context = useContext(CallContext)
  if (context === undefined) {
    throw new Error('useCallContext must be used within CallProvider')
  }
  return context
}
