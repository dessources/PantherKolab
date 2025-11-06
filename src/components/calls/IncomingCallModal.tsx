'use client'

import React, { useState, useEffect } from 'react'
import { CallIncomingPayload } from '@/types/socketEvents'

interface IncomingCallModalProps {
  callPayload: CallIncomingPayload | null
  isOpen: boolean
  callerName?: string
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onIgnore?: () => void
  isLoading?: boolean
}

/**
 * Modal component for incoming call notifications
 * Shows caller info and Accept/Decline/Ignore options
 */
export function IncomingCallModal({
  callPayload,
  isOpen,
  callerName,
  onAccept,
  onDecline,
  onIgnore,
  isLoading = false,
}: IncomingCallModalProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  // Play ringing sound when modal opens
  useEffect(() => {
    if (isOpen && !audioElement) {
      const audio = new Audio('/sounds/call-ringing.mp3')
      audio.loop = true
      audio.play().catch((error) => console.log('Auto-play prevented:', error))
      setAudioElement(audio)
    }

    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
    }
  }, [isOpen, audioElement])

  // Stop audio when modal closes
  useEffect(() => {
    if (!isOpen && audioElement) {
      audioElement.pause()
      setAudioElement(null)
    }
  }, [isOpen, audioElement])

  const handleAccept = async () => {
    try {
      setIsAccepting(true)
      audioElement?.pause()
      await onAccept()
    } catch (error) {
      console.error('Error accepting call:', error)
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    try {
      setIsDeclining(true)
      audioElement?.pause()
      await onDecline()
    } catch (error) {
      console.error('Error declining call:', error)
      setIsDeclining(false)
    }
  }

  const handleIgnore = () => {
    audioElement?.pause()
    onIgnore?.()
  }

  if (!isOpen || !callPayload) {
    return null
  }

  const displayName = callerName || callPayload.initiatorId
  const isGroupCall = callPayload.callType === 'GROUP'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Header with gradient */}
          <div className="relative h-40 bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center">
            {/* Animated rings background */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-32 h-32 border-2 border-white rounded-full animate-pulse" />
                <div className="w-24 h-24 border-2 border-white rounded-full animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Caller avatar placeholder */}
            <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-blue-600 font-['Bitter'] mb-4">
              {displayName.charAt(0).toUpperCase()}
            </div>

            {/* Incoming call text */}
            <h2 className="relative z-10 text-white text-lg font-semibold font-['Bitter']">
              {isGroupCall ? 'Group Call' : 'Incoming Call'}
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-8 space-y-6">
            {/* Caller name */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 font-['Bitter']">{displayName}</p>
              {isGroupCall && (
                <p className="text-sm text-gray-500 mt-2">
                  {callPayload.participantIds.length} participants
                </p>
              )}
            </div>

            {/* Call info */}
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-['Bitter']">
                {isGroupCall ? 'Group video call' : 'Video call'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-4">
              {/* Decline button */}
              <button
                onClick={handleDecline}
                disabled={isDeclining || isAccepting || isLoading}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-semibold font-['Bitter'] rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {isDeclining ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Declining...</span>
                  </>
                ) : (
                  <>
                    <span>✕</span>
                    <span>Decline</span>
                  </>
                )}
              </button>

              {/* Accept button */}
              <button
                onClick={handleAccept}
                disabled={isAccepting || isDeclining || isLoading}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold font-['Bitter'] rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {isAccepting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Accepting...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Accept</span>
                  </>
                )}
              </button>
            </div>

            {/* Ignore button */}
            {onIgnore && (
              <button
                onClick={handleIgnore}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-['Bitter'] transition-colors duration-200"
              >
                Ignore
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
