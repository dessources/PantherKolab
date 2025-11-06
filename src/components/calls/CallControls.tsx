'use client'

import React from 'react'

interface CallControlsProps {
  isMuted?: boolean
  onMuteToggle?: (isMuted: boolean) => void
  isCameraOn?: boolean
  onCameraToggle?: (isCameraOn: boolean) => void
  onEndCall?: () => Promise<void>
  isLoading?: boolean
  showScreenShare?: boolean
  onScreenShare?: () => Promise<void>
  compact?: boolean
  orientation?: 'horizontal' | 'vertical'
}

/**
 * Reusable call controls component
 * Provides mute, camera, screen share, and end call controls
 */
export function CallControls({
  isMuted = false,
  onMuteToggle,
  isCameraOn = true,
  onCameraToggle,
  onEndCall,
  isLoading = false,
  showScreenShare = false,
  onScreenShare,
  compact = false,
  orientation = 'horizontal',
}: CallControlsProps) {
  const [isEndingCall, setIsEndingCall] = React.useState(false)
  const [isScreenSharing, setIsScreenSharing] = React.useState(false)

  const handleMuteClick = () => {
    onMuteToggle?.(!isMuted)
  }

  const handleCameraClick = () => {
    onCameraToggle?.(!isCameraOn)
  }

  const handleScreenShareClick = async () => {
    try {
      setIsScreenSharing(true)
      await onScreenShare?.()
    } catch (error) {
      console.error('Screen share failed:', error)
      setIsScreenSharing(false)
    }
  }

  const handleEndCallClick = async () => {
    try {
      setIsEndingCall(true)
      await onEndCall?.()
    } catch (error) {
      console.error('End call failed:', error)
      setIsEndingCall(false)
    }
  }

  const buttonSize = compact ? 'p-2' : 'p-3'
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5'
  const containerClass =
    orientation === 'horizontal' ? 'flex flex-row gap-3' : 'flex flex-col gap-3'

  return (
    <div className={containerClass}>
      {/* Mute button */}
      {onMuteToggle && (
        <button
          onClick={handleMuteClick}
          disabled={isLoading}
          className={`${buttonSize} rounded-full transition-colors ${
            isMuted
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.114 5.636l1.414-1.414 1.414 1.414-1.414 1.414 1.414 1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414 1.414 1.414z" />
            </svg>
          ) : (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 16.91c-1.25.81-2.76 1.29-4.39 1.29-1.63 0-3.14-.48-4.39-1.29l-1.41 1.41c1.78 1.38 4.02 2.21 6.43 2.32v2.94h2v-2.93c2.41-.11 4.65-.94 6.43-2.32l-1.41-1.41z" />
            </svg>
          )}
        </button>
      )}

      {/* Camera button */}
      {onCameraToggle && (
        <button
          onClick={handleCameraClick}
          disabled={isLoading}
          className={`${buttonSize} rounded-full transition-colors ${
            !isCameraOn
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isCameraOn ? 'Stop camera' : 'Start camera'}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
            </svg>
          ) : (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
            </svg>
          )}
        </button>
      )}

      {/* Screen share button */}
      {showScreenShare && onScreenShare && (
        <button
          onClick={handleScreenShareClick}
          disabled={isLoading || isScreenSharing}
          className={`${buttonSize} rounded-full transition-colors ${
            isScreenSharing
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          {isScreenSharing ? (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      )}

      {/* End call button */}
      {onEndCall && (
        <button
          onClick={handleEndCallClick}
          disabled={isEndingCall || isLoading}
          className={`${buttonSize} rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          title="End call"
          aria-label="End call"
        >
          {isEndingCall ? (
            <div className={`${iconSize} border-2 border-white border-t-transparent rounded-full animate-spin`} />
          ) : (
            <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
