/**
 * Chime Manager - Core Wrapper around AWS Chime SDK
 * Manages meeting sessions, audio/video devices, and media streams
 * Provides a clean interface for React components to interact with Chime
 */

import {
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  DefaultDeviceController,
  AudioVideoObserver,
  Logger,
  ConsoleLogger,
  LogLevel,
  VideoTileState,
} from 'amazon-chime-sdk-js'

/**
 * Configuration for ChimeManager initialization
 */
export interface ChimeManagerConfig {
  loggingLevel?: LogLevel
  enableLogging?: boolean
  videoConstraints?: MediaTrackConstraints
}

/**
 * Device information
 */
export interface DeviceInfo {
  deviceId: string
  label: string
  groupId?: string
}

/**
 * Observer callbacks for Chime events
 */
export interface ChimeObserver {
  onParticipantJoined?: (attendeeId: string, externalUserId: string) => void
  onParticipantLeft?: (attendeeId: string) => void
  onVideoTileAdded?: (tileState: VideoTileState) => void
  onVideoTileRemoved?: (tileState: VideoTileState) => void
  onAudioSessionStarted?: () => void
  onAudioSessionStopped?: () => void
  onConnectionStateChanged?: (state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void
  onError?: (error: Error) => void
}

/**
 * Chime Manager - Singleton wrapper around Chime SDK
 */
class ChimeManager {
  private session: DefaultMeetingSession | null = null
  private deviceController: DefaultDeviceController | null = null
  private logger: Logger
  private config: Required<ChimeManagerConfig>
  private observers: ChimeObserver = {}
  private participantMap = new Map<string, string>() // attendeeId -> externalUserId
  private videoTileMap = new Map<number, string>() // tileId -> attendeeId
  private isInitialized = false
  private isJoined = false
  private audioInputDevices: DeviceInfo[] = []
  private videoInputDevices: DeviceInfo[] = []
  private audioOutputDevices: DeviceInfo[] = []
  private currentAudioInputId: string | null = null
  private currentVideoInputId: string | null = null
  private currentAudioOutputId: string | null = null

  constructor(config?: ChimeManagerConfig) {
    this.config = {
      loggingLevel: config?.loggingLevel ?? LogLevel.INFO,
      enableLogging: config?.enableLogging ?? false,
      videoConstraints: config?.videoConstraints ?? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }

    // Always create a logger for Chime SDK (it requires one)
    this.logger = new ConsoleLogger('ChimeManager', this.config.loggingLevel)

    this.log('ChimeManager initialized')
  }

  /**
   * Log messages if logging enabled
   */
  private log(message: string): void {
    if (this.logger) {
      this.logger.info(message)
    }
  }

  /**
   * Initialize Chime session with meeting credentials
   */
  async initializeSession(joinToken: string): Promise<void> {
    try {
      this.log('Initializing Chime session with token')

      // Fetch meeting and attendee info from join token
      // The token contains encoded meeting and attendee details
      const response = await fetch('/api/calls/join-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinToken }),
      })

      if (!response.ok) {
        throw new Error(`Failed to get join info: ${response.statusText}`)
      }

      const { meetingResponse, attendeeResponse } = await response.json()

      // Create configuration
      const configuration = new MeetingSessionConfiguration(meetingResponse, attendeeResponse)

      // Create device controller
      this.deviceController = new DefaultDeviceController(this.logger)

      // Create Chime session
      this.session = new DefaultMeetingSession(configuration, this.logger, this.deviceController)

      // Setup observers
      this.setupObservers()

      this.isInitialized = true
      this.log('Chime session initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to initialize session: ${errorMessage}`)
      this.observers.onError?.(new Error(`Session initialization failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Setup Chime SDK observers for various events
   */
  private setupObservers(): void {
    if (!this.session) return

    const audioVideo = this.session.audioVideo

    // Audio/Video observer for connection events
    const audioVideoObserver: AudioVideoObserver = {
      audioVideoDidStart: () => {
        this.log('Audio/Video session started')
        this.observers.onAudioSessionStarted?.()
      },
      audioVideoDidStop: () => {
        this.log('Audio/Video session stopped')
        this.observers.onAudioSessionStopped?.()
      },
    }

    audioVideo.addObserver(audioVideoObserver)

    // Setup realtime observer for participant presence events
    audioVideo.realtimeSubscribeToAttendeeIdPresence(
      (attendeeId: string, present: boolean, externalUserId?: string) => {
        if (present) {
          if (!this.participantMap.has(attendeeId)) {
            const userId = externalUserId || attendeeId
            this.participantMap.set(attendeeId, userId)
            this.log(`Participant joined: ${attendeeId}`)
            this.observers.onParticipantJoined?.(attendeeId, userId)
          }
        } else {
          if (this.participantMap.has(attendeeId)) {
            this.participantMap.delete(attendeeId)
            this.log(`Participant left: ${attendeeId}`)
            this.observers.onParticipantLeft?.(attendeeId)
          }
        }
      }
    )
  }

  /**
   * Start meeting session
   */
  async start(): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Starting meeting')
      this.session.audioVideo.start()
      this.isJoined = true
      this.log('Meeting started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to start meeting: ${errorMessage}`)
      this.observers.onError?.(new Error(`Meeting start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop meeting session
   */
  async stop(): Promise<void> {
    try {
      if (!this.session) return

      this.log('Stopping meeting')
      this.session.audioVideo.stop()
      this.isJoined = false
      this.log('Meeting stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to stop meeting: ${errorMessage}`)
    }
  }

  /**
   * Start local audio
   */
  async startLocalAudio(): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Starting local audio')
      this.session.audioVideo.realtimeUnmuteLocalAudio()
      this.log('Local audio started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to start local audio: ${errorMessage}`)
      this.observers.onError?.(new Error(`Local audio start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop local audio
   */
  async stopLocalAudio(): Promise<void> {
    try {
      if (!this.session) return

      this.log('Stopping local audio')
      this.session.audioVideo.realtimeMuteLocalAudio()
      this.log('Local audio stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to stop local audio: ${errorMessage}`)
    }
  }

  /**
   * Start local video
   */
  async startLocalVideo(): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Starting local video')
      const videoInputDevice = this.currentVideoInputId
        ? this.videoInputDevices.find((d) => d.deviceId === this.currentVideoInputId)
        : this.videoInputDevices[0]

      if (videoInputDevice) {
        await this.session.audioVideo.startVideoInput(videoInputDevice.deviceId)
      }

      // Start the local video tile
      const tileId = this.session.audioVideo.startLocalVideoTile()
      this.log(`Local video started with tile ID: ${tileId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to start local video: ${errorMessage}`)
      this.observers.onError?.(new Error(`Local video start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop local video
   */
  async stopLocalVideo(): Promise<void> {
    try {
      if (!this.session) return

      this.log('Stopping local video')
      this.session.audioVideo.stopLocalVideoTile()
      await this.session.audioVideo.stopVideoInput()
      this.log('Local video stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to stop local video: ${errorMessage}`)
    }
  }

  /**
   * Enumerate audio input devices (microphones)
   */
  async enumerateAudioInputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Enumerating audio input devices')
      const devices = await this.session.audioVideo.listAudioInputDevices()

      this.audioInputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log(`Found audio input devices: ${this.audioInputDevices.length}`)
      return this.audioInputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to enumerate audio devices: ${errorMessage}`)
      return []
    }
  }

  /**
   * Enumerate video input devices (cameras)
   */
  async enumerateVideoInputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Enumerating video input devices')
      const devices = await this.session.audioVideo.listVideoInputDevices()

      this.videoInputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log(`Found video input devices: ${this.videoInputDevices.length}`)
      return this.videoInputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to enumerate video devices: ${errorMessage}`)
      return []
    }
  }

  /**
   * Enumerate audio output devices (speakers)
   */
  async enumerateAudioOutputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log('Enumerating audio output devices')
      const devices = await this.session.audioVideo.listAudioOutputDevices()

      this.audioOutputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log(`Found audio output devices: ${this.audioOutputDevices.length}`)
      return this.audioOutputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to enumerate audio output devices: ${errorMessage}`)
      return []
    }
  }

  /**
   * Select audio input device (microphone)
   */
  async selectAudioInput(deviceId: string): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log(`Selecting audio input: ${deviceId}`)
      const device = this.audioInputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Audio input device not found: ${deviceId}`)
      }

      await this.session.audioVideo.startAudioInput(device.deviceId)
      this.currentAudioInputId = deviceId
      this.log(`Audio input selected: ${deviceId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to select audio input: ${errorMessage}`)
      this.observers.onError?.(new Error(`Audio input selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Select video input device (camera)
   */
  async selectVideoInput(deviceId: string): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log(`Selecting video input: ${deviceId}`)
      const device = this.videoInputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Video input device not found: ${deviceId}`)
      }

      await this.session.audioVideo.startVideoInput(device.deviceId)
      this.currentVideoInputId = deviceId
      this.log(`Video input selected: ${deviceId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to select video input: ${errorMessage}`)
      this.observers.onError?.(new Error(`Video input selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Select audio output device (speaker)
   */
  async selectAudioOutput(deviceId: string): Promise<void> {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log(`Selecting audio output: ${deviceId}`)
      const device = this.audioOutputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Audio output device not found: ${deviceId}`)
      }

      await this.session.audioVideo.chooseAudioOutput(deviceId)
      this.currentAudioOutputId = deviceId
      this.log(`Audio output selected: ${deviceId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to select audio output: ${errorMessage}`)
      this.observers.onError?.(new Error(`Audio output selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Bind remote video to HTML element
   */
  bindVideoElement(tileId: number, videoElement: HTMLVideoElement): void {
    try {
      if (!this.session) {
        throw new Error('Session not initialized')
      }

      this.log(`Binding video element for tile: ${tileId}`)
      this.session.audioVideo.bindVideoElement(tileId, videoElement)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to bind video element: ${errorMessage}`)
    }
  }

  /**
   * Unbind video element
   */
  unbindVideoElement(tileId: number, cleanUpVideoElement = true): void {
    try {
      if (!this.session) return

      this.log(`Unbinding video element for tile: ${tileId}`)
      this.session.audioVideo.unbindVideoElement(tileId, cleanUpVideoElement)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Failed to unbind video element: ${errorMessage}`)
    }
  }

  /**
   * Get current audio input device
   */
  getCurrentAudioInputDevice(): DeviceInfo | null {
    if (!this.currentAudioInputId) return null
    return this.audioInputDevices.find((d) => d.deviceId === this.currentAudioInputId) || null
  }

  /**
   * Get current video input device
   */
  getCurrentVideoInputDevice(): DeviceInfo | null {
    if (!this.currentVideoInputId) return null
    return this.videoInputDevices.find((d) => d.deviceId === this.currentVideoInputId) || null
  }

  /**
   * Get current audio output device
   */
  getCurrentAudioOutputDevice(): DeviceInfo | null {
    if (!this.currentAudioOutputId) return null
    return this.audioOutputDevices.find((d) => d.deviceId === this.currentAudioOutputId) || null
  }

  /**
   * Get participant information
   */
  getParticipants(): Array<{ attendeeId: string; externalUserId: string }> {
    return Array.from(this.participantMap.entries()).map(([attendeeId, externalUserId]) => ({
      attendeeId,
      externalUserId,
    }))
  }

  /**
   * Subscribe to Chime events
   */
  subscribe(observer: ChimeObserver): void {
    this.observers = { ...this.observers, ...observer }
  }

  /**
   * Check if session is initialized
   */
  isInitializedSession(): boolean {
    return this.isInitialized
  }

  /**
   * Check if joined to meeting
   */
  isJoinedToMeeting(): boolean {
    return this.isJoined
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    try {
      this.log('Cleaning up Chime session')

      // Stop audio and video
      await this.stopLocalAudio().catch(() => {})
      await this.stopLocalVideo().catch(() => {})

      // Stop meeting
      await this.stop().catch(() => {})

      // Reset state
      this.session = null
      this.isInitialized = false
      this.isJoined = false
      this.participantMap.clear()
      this.videoTileMap.clear()

      this.log('Chime session cleaned up')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Error during cleanup: ${errorMessage}`)
    }
  }
}

// Singleton instance
let instance: ChimeManager | null = null

/**
 * Get or create ChimeManager singleton
 */
export function getChimeManager(config?: ChimeManagerConfig): ChimeManager {
  if (!instance) {
    instance = new ChimeManager(config)
  }
  return instance
}

/**
 * Reset ChimeManager singleton
 */
export function resetChimeManager(): void {
  instance?.cleanup().catch(() => {})
  instance = null
}
