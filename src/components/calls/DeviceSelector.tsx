'use client'

import React, { useState, useEffect } from 'react'
import { getChimeManager } from '@/lib/chime/ChimeManager'
import type { DeviceInfo } from '@/lib/chime/ChimeManager'

interface DeviceSelectorProps {
  isOpen: boolean
  onClose: () => void
  onDeviceSelected?: (deviceType: 'audio' | 'video', deviceId: string) => void
}

/**
 * Device selector modal for choosing audio/video input devices
 * Allows users to select microphone, camera, and speaker
 */
export function DeviceSelector({ isOpen, onClose, onDeviceSelected }: DeviceSelectorProps) {
  const [audioInputDevices, setAudioInputDevices] = useState<DeviceInfo[]>([])
  const [videoInputDevices, setVideoInputDevices] = useState<DeviceInfo[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<DeviceInfo[]>([])
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('')
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('')
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available devices when modal opens
  useEffect(() => {
    if (!isOpen) return

    const loadDevices = async () => {
      try {
        setLoading(true)
        setError(null)

        const chimeManager = getChimeManager()

        // Enumerate all available devices
        const audioInputs = await chimeManager.enumerateAudioInputDevices()
        const videoInputs = await chimeManager.enumerateVideoInputDevices()
        const audioOutputs = await chimeManager.enumerateAudioOutputDevices()

        setAudioInputDevices(audioInputs)
        setVideoInputDevices(videoInputs)
        setAudioOutputDevices(audioOutputs)

        // Set default selections to current devices or first available
        const currentAudioInput = chimeManager.getCurrentAudioInputDevice()
        const currentVideoInput = chimeManager.getCurrentVideoInputDevice()
        const currentAudioOutput = chimeManager.getCurrentAudioOutputDevice()

        if (currentAudioInput) {
          setSelectedAudioInput(currentAudioInput.deviceId)
        } else if (audioInputs.length > 0) {
          setSelectedAudioInput(audioInputs[0].deviceId)
        }

        if (currentVideoInput) {
          setSelectedVideoInput(currentVideoInput.deviceId)
        } else if (videoInputs.length > 0) {
          setSelectedVideoInput(videoInputs[0].deviceId)
        }

        if (currentAudioOutput) {
          setSelectedAudioOutput(currentAudioOutput.deviceId)
        } else if (audioOutputs.length > 0) {
          setSelectedAudioOutput(audioOutputs[0].deviceId)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load devices'
        setError(errorMessage)
        console.error('Error loading devices:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDevices()
  }, [isOpen])

  // Handle device selection
  const handleAudioInputChange = async (deviceId: string) => {
    try {
      setSelectedAudioInput(deviceId)
      const chimeManager = getChimeManager()
      await chimeManager.selectAudioInput(deviceId)
      onDeviceSelected?.('audio', deviceId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select audio input'
      setError(errorMessage)
      console.error('Error selecting audio input:', err)
    }
  }

  const handleVideoInputChange = async (deviceId: string) => {
    try {
      setSelectedVideoInput(deviceId)
      const chimeManager = getChimeManager()
      await chimeManager.selectVideoInput(deviceId)
      onDeviceSelected?.('video', deviceId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select video input'
      setError(errorMessage)
      console.error('Error selecting video input:', err)
    }
  }

  const handleAudioOutputChange = async (deviceId: string) => {
    try {
      setSelectedAudioOutput(deviceId)
      const chimeManager = getChimeManager()
      await chimeManager.selectAudioOutput(deviceId)
      onDeviceSelected?.('audio', deviceId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select audio output'
      setError(errorMessage)
      console.error('Error selecting audio output:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white font-['Bitter']">Device Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Microphone selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Microphone</label>
              {audioInputDevices.length === 0 ? (
                <p className="text-gray-500 text-sm">No microphones available</p>
              ) : (
                <select
                  value={selectedAudioInput}
                  onChange={(e) => handleAudioInputChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {audioInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Camera selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Camera</label>
              {videoInputDevices.length === 0 ? (
                <p className="text-gray-500 text-sm">No cameras available</p>
              ) : (
                <select
                  value={selectedVideoInput}
                  onChange={(e) => handleVideoInputChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {videoInputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Speaker selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Speaker</label>
              {audioOutputDevices.length === 0 ? (
                <p className="text-gray-500 text-sm">No speakers available</p>
              ) : (
                <select
                  value={selectedAudioOutput}
                  onChange={(e) => handleAudioOutputChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {audioOutputDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
