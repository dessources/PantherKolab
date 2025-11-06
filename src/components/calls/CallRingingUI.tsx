'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CallRingingUIProps {
  isOpen: boolean
  recipientName?: string
  recipientCount?: number
  callType: 'DIRECT' | 'GROUP'
  onCancel: () => Promise<void>
  isLoading?: boolean
  timeout?: number // milliseconds before auto-timeout
}

/**
 * UI component for outgoing call state
 * Shows recipient info and waiting status
 */
export function CallRingingUI({
  isOpen,
  recipientName,
  recipientCount = 0,
  callType,
  onCancel,
  isLoading = false,
  timeout = 60000, // 60 seconds default timeout
}: CallRingingUIProps) {
  const [isCanceling, setIsCanceling] = useState(false)
  const [ringDuration, setRingDuration] = useState(0)
  const [shouldTimeout, setShouldTimeout] = useState(false)
  const durationInterval = useRef<NodeJS.Timeout | null>(null)
  const audioElement = useRef<HTMLAudioElement | null>(null)

  // Play ringing sound and track duration
  useEffect(() => {
    if (isOpen) {
      // Play ringback tone
      const audio = new Audio('/sounds/call-ringback.mp3')
      audio.loop = true
      audio.play().catch((error) => console.log('Auto-play prevented:', error))
      audioElement.current = audio

      // Track ringing duration
      durationInterval.current = setInterval(() => {
        setRingDuration((prev) => prev + 1)
      }, 1000)

      // Auto-timeout after specified duration
      const timeoutTimer = setTimeout(() => {
        setShouldTimeout(true)
      }, timeout)

      return () => {
        clearInterval(durationInterval.current!)
        clearTimeout(timeoutTimer)
        if (audioElement.current) {
          audioElement.current.pause()
          audioElement.current = null
        }
      }
    }
  }, [isOpen, timeout])

  const handleCancel = async () => {
    try {
      setIsCanceling(true)
      audioElement.current?.pause()
      await onCancel()
    } catch (error) {
      console.error('Error canceling call:', error)
      setIsCanceling(false)
    }
  }

  // Auto-cancel on timeout
  useEffect(() => {
    if (shouldTimeout && !isCanceling) {
      handleCancel()
    }
  }, [shouldTimeout])

  if (!isOpen) {
    return null
  }

  const isGroupCall = callType === 'GROUP'
  const displayName = isGroupCall ? `Group (${recipientCount})` : recipientName || 'Calling...'

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
          <div className="relative h-48 bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center">
            {/* Pulsing animation background */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-40 h-40 border-2 border-white rounded-full animate-bounce" />
                <div className="w-32 h-32 border-2 border-white rounded-full animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="w-24 h-24 border-2 border-white rounded-full animate-bounce absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Recipient avatar placeholder */}
            <div className="relative z-10 w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 font-['Bitter'] mb-4 animate-pulse">
              {displayName.charAt(0).toUpperCase()}
            </div>

            {/* Calling text with animation */}
            <h2 className="relative z-10 text-white text-lg font-semibold font-['Bitter']">
              Calling...
              <span className="inline-block ml-1">
                <span className="inline-block w-1 h-1 bg-white rounded-full animate-bounce mr-1" style={{ animationDelay: '0s' }} />
                <span className="inline-block w-1 h-1 bg-white rounded-full animate-bounce mr-1" style={{ animationDelay: '0.2s' }} />
                <span className="inline-block w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </span>
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-8 space-y-6">
            {/* Recipient name */}
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 font-['Bitter']">{displayName}</p>
              {isGroupCall && (
                <p className="text-sm text-gray-500 mt-2">{recipientCount} participants invited</p>
              )}
            </div>

            {/* Call duration */}
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-['Bitter']">
                {Math.floor(ringDuration / 60)}:{(ringDuration % 60).toString().padStart(2, '0')} seconds
              </p>
            </div>

            {/* Status message */}
            <div className="text-center">
              {shouldTimeout ? (
                <p className="text-sm text-red-600 font-['Bitter']">Call not answered, canceling...</p>
              ) : (
                <p className="text-sm text-gray-600 font-['Bitter']">
                  {isGroupCall ? 'Waiting for participants to join' : 'Waiting for response'}
                </p>
              )}
            </div>

            {/* Cancel button */}
            <button
              onClick={handleCancel}
              disabled={isCanceling || isLoading || shouldTimeout}
              className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-semibold font-['Bitter'] rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {isCanceling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Canceling...</span>
                </>
              ) : shouldTimeout ? (
                <>
                  <span>✕</span>
                  <span>No Answer</span>
                </>
              ) : (
                <>
                  <span>✕</span>
                  <span>Cancel Call</span>
                </>
              )}
            </button>

            {/* Tip */}
            <p className="text-center text-xs text-gray-400 font-['Bitter']">
              {isGroupCall
                ? 'Call will be canceled if no one joins within 1 minute'
                : 'Call will be canceled if not answered within 1 minute'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
