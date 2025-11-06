'use client'

import React, { useEffect, useCallback } from 'react'
import { useCallSocket } from '@/hooks/useCallSocket'
import { useCallContext } from '@/components/contexts/CallContext'
import { IncomingCallModal } from '@/components/calls/IncomingCallModal'
import { CallWindow } from '@/components/calls/CallWindow'
import { CallRingingUI } from '@/components/calls/CallRingingUI'
import { CallIncomingPayload, CallActionPayload } from '@/types/socketEvents'

/**
 * CallManager component
 * Orchestrates Socket.IO, UI components, and call state management
 * Should be placed near the root of the app
 */

interface CallManagerProps {
  userId?: string
  userDisplayName?: string
  onCallStatusChange?: (status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended') => void
}

export function CallManager({
  userId = 'unknown-user',
  userDisplayName = 'You',
  onCallStatusChange,
}: CallManagerProps) {
  const {
    activeCall,
    incomingCall,
    isMuted,
    isCameraOn,
    isLoading,
    error,
    setIncomingCall,
    setActiveCall,
    updateCallStatus,
    acceptCall: contextAcceptCall,
    declineCall: contextDeclineCall,
    endCall: contextEndCall,
    toggleMute,
    toggleCamera,
    clearError,
  } = useCallContext()

  // Socket.IO hooks
  const {
    isConnected,
    status: socketStatus,
    error: socketError,
    initiateCall: socketInitiateCall,
    acceptCall: socketAcceptCall,
    declineCall: socketDeclineCall,
    endCall: socketEndCall,
  } = useCallSocket({
    enabled: true,
    onIncomingCall: (payload: CallIncomingPayload) => {
      console.log('[CallManager] Incoming call received:', payload)
      setIncomingCall({
        sessionId: payload.sessionId,
        initiatorId: payload.initiatorId,
        initiatorName: payload.initiatorId, // TODO: resolve from user service
        callType: payload.callType,
        participantIds: payload.participantIds,
        meetingInfo: payload.meetingInfo,
        timestamp: payload.timestamp,
      })
      onCallStatusChange?.('ringing')
    },
    onCallAccepted: (payload: CallActionPayload) => {
      console.log('[CallManager] Call accepted by:', payload.userId)
      updateCallStatus(payload.sessionId, 'active')
      onCallStatusChange?.('active')
    },
    onCallDeclined: (payload: CallActionPayload) => {
      console.log('[CallManager] Call declined by:', payload.userId)
      updateCallStatus(payload.sessionId, 'ended')
      setActiveCall(null)
      onCallStatusChange?.('idle')
    },
    onCallEnded: (payload: CallActionPayload) => {
      console.log('[CallManager] Call ended by:', payload.userId)
      setActiveCall(null)
      onCallStatusChange?.('idle')
    },
    onConnectionChange: (newStatus) => {
      console.log('[CallManager] Socket status:', newStatus)
    },
    onError: (errorMessage) => {
      console.error('[CallManager] Socket error:', errorMessage)
    },
  })

  /**
   * Handle incoming call acceptance
   */
  const handleAcceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return

    try {
      // Accept via Socket.IO
      await socketAcceptCall(incomingCall.sessionId)

      // Update call context
      await contextAcceptCall(incomingCall.sessionId)

      // Fetch join info from the new endpoint and store it in activeCall
      try {
        const token = localStorage.getItem('auth_token')
        if (token && activeCall?.sessionId === incomingCall.sessionId) {
          const joinInfoResponse = await fetch('/api/calls/join-info', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              sessionId: incomingCall.sessionId,
              timestamp: incomingCall.timestamp,
            }),
          })

          if (joinInfoResponse.ok) {
            const joinInfoData = await joinInfoResponse.json()
            if (joinInfoData.success && joinInfoData.data) {
              // Update active call with join token and attendee info
              setActiveCall({
                ...activeCall,
                joinToken: joinInfoData.data.joinToken,
                attendeeId: joinInfoData.data.attendeeId,
                timestamp: incomingCall.timestamp,
              })
            }
          }
        }
      } catch (joinInfoError) {
        console.error('[CallManager] Failed to fetch join info:', joinInfoError)
      }

      // Update status
      updateCallStatus(incomingCall.sessionId, 'active')
      onCallStatusChange?.('active')
    } catch (err) {
      console.error('[CallManager] Failed to accept call:', err)
    }
  }, [incomingCall, activeCall, socketAcceptCall, contextAcceptCall, updateCallStatus, setActiveCall, onCallStatusChange])

  /**
   * Handle incoming call decline
   */
  const handleDeclineIncomingCall = useCallback(async () => {
    if (!incomingCall) return

    try {
      // Decline via Socket.IO
      await socketDeclineCall(incomingCall.sessionId)

      // Update call context
      await contextDeclineCall(incomingCall.sessionId)

      // Clear incoming call
      setIncomingCall(null)
      onCallStatusChange?.('idle')
    } catch (err) {
      console.error('[CallManager] Failed to decline call:', err)
    }
  }, [incomingCall, socketDeclineCall, contextDeclineCall, setIncomingCall, onCallStatusChange])

  /**
   * Handle end active call
   */
  const handleEndActiveCall = useCallback(async () => {
    if (!activeCall) return

    try {
      // End via Socket.IO
      await socketEndCall(activeCall.sessionId)

      // Update call context
      await contextEndCall(activeCall.sessionId)

      // Clear active call
      setActiveCall(null)
      onCallStatusChange?.('idle')
    } catch (err) {
      console.error('[CallManager] Failed to end call:', err)
    }
  }, [activeCall, socketEndCall, contextEndCall, setActiveCall, onCallStatusChange])

  /**
   * Handle call cancellation (for ringing state)
   */
  const handleCancelCall = useCallback(async () => {
    if (!activeCall) return

    try {
      await socketEndCall(activeCall.sessionId)
      setActiveCall(null)
      onCallStatusChange?.('idle')
    } catch (err) {
      console.error('[CallManager] Failed to cancel call:', err)
    }
  }, [activeCall, socketEndCall, setActiveCall, onCallStatusChange])

  // Display socket errors
  useEffect(() => {
    if (socketError) {
      console.error('[CallManager] Socket error:', socketError)
    }
  }, [socketError])

  return (
    <>
      {/* Error display */}
      {(error || socketError) && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 z-[60]">
          <div className="flex items-center justify-between">
            <p className="text-red-800 text-sm font-['Bitter']">{error || socketError}</p>
            <button
              onClick={() => clearError()}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Incoming call modal */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callPayload={{
            sessionId: incomingCall.sessionId,
            initiatorId: incomingCall.initiatorId,
            callType: incomingCall.callType,
            participantIds: incomingCall.participantIds,
            meetingInfo: incomingCall.meetingInfo || {},
            timestamp: incomingCall.timestamp,
          }}
          callerName={incomingCall.initiatorName}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
          onIgnore={() => setIncomingCall(null)}
          isLoading={isLoading}
        />
      )}

      {/* Ringing UI for outgoing calls */}
      {activeCall && activeCall.status === 'ringing' && (
        <CallRingingUI
          isOpen={true}
          recipientName={
            activeCall.callType === 'DIRECT'
              ? activeCall.participantNames?.[activeCall.participantIds[0]] ||
                activeCall.participantIds[0]
              : undefined
          }
          recipientCount={activeCall.participantIds.length}
          callType={activeCall.callType}
          onCancel={handleCancelCall}
          isLoading={isLoading}
          timeout={60000}
        />
      )}

      {/* Active call window */}
      {activeCall && (activeCall.status === 'active' || activeCall.status === 'connecting') && (
        <CallWindow
          isOpen={true}
          callType={activeCall.callType}
          participantName={
            activeCall.callType === 'DIRECT'
              ? activeCall.participantNames?.[activeCall.participantIds[0]] ||
                activeCall.participantIds[0]
              : undefined
          }
          participantCount={activeCall.participantIds.length}
          onMuteToggle={toggleMute}
          onCameraToggle={toggleCamera}
          onEndCall={handleEndActiveCall}
          localVideoRef={activeCall.localVideoRef}
          remoteVideoRefs={activeCall.remoteVideoRefs}
          isLoading={isLoading}
          connectionStatus={
            activeCall.status === 'connecting' ? 'connecting' : 'connected'
          }
          joinToken={activeCall.joinToken}
        />
      )}
    </>
  )
}
