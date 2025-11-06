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
  AudioVideoFacade,
  VideoTileState,
  VideoTileObserver,
  RemoteVideoUpdate,
  RemoteVideoUpdateType,
  Logger,
  ConsoleLogger,
  LogLevel,
  DefaultScreenShareViewFacade,
  ScreenShareViewFacade,
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
  private audioVideo: AudioVideoFacade | null = null
  private screenShare: ScreenShareViewFacade | null = null
  private logger: Logger | null = null
  private config: Required<ChimeManagerConfig>
  private observers: ChimeObserver = {}
  private participantMap = new Map<string, string>() // attendeeId -> externalUserId
  private videoTileMap = new Map<number, string>() // tileId -> attendeeId
  private isInitialized = false
  private isJoined = false
  private localVideoElement: HTMLVideoElement | null = null
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

    if (this.config.enableLogging) {
      this.logger = new ConsoleLogger('ChimeManager', this.config.loggingLevel)
    }

    this.log('ChimeManager initialized')
  }

  /**
   * Log messages if logging enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.logger) {
      this.logger.info(message, args)
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
      this.audioVideo = this.session.audioVideo

      // Setup observers
      this.setupObservers()

      this.isInitialized = true
      this.log('Chime session initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to initialize session:', errorMessage)
      this.observers.onError?.(new Error(`Session initialization failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Setup Chime SDK observers for various events
   */
  private setupObservers(): void {
    if (!this.audioVideo) return

    // Audio/Video observer for connection events
    const audioVideoObserver: AudioVideoObserver = {
      onAudioSessionStarted: async () => {
        this.log('Audio session started')
        this.observers.onAudioSessionStarted?.()
      },
      onAudioSessionStopped: async () => {
        this.log('Audio session stopped')
        this.observers.onAudioSessionStopped?.()
      },
      onAudioInputStreamSelectionChanged: async () => {
        this.log('Audio input changed')
      },
      onVideoInputStreamSelectionChanged: async () => {
        this.log('Video input changed')
      },
      onConnectionStateChanged: async (connectionState: any) => {
        this.log('Connection state changed:', connectionState)
        this.observers.onConnectionStateChanged?.(connectionState)
      },
    }

    this.audioVideo.addObserver(audioVideoObserver)

    // Video tile observer for participant video changes
    const videoTileObserver: VideoTileObserver = {
      onVideoTileAdded: (tileState: VideoTileState) => {
        this.log('Video tile added:', tileState.tileId)
        const attendeeId = tileState.boundAttendeeId
        if (attendeeId) {
          this.videoTileMap.set(tileState.tileId, attendeeId)
        }
        this.observers.onVideoTileAdded?.(tileState)
      },
      onVideoTileRemoved: (tileState: VideoTileState) => {
        this.log('Video tile removed:', tileState.tileId)
        this.videoTileMap.delete(tileState.tileId)
        this.observers.onVideoTileRemoved?.(tileState)
      },
      onVideoTilesChanged: (videoTileStates: VideoTileState[]) => {
        // Called when video tile states change
        this.log('Video tiles changed:', videoTileStates.length)
      },
      onRemoteVideoSourceAvailable: (updates: RemoteVideoUpdate[]) => {
        // Called when remote video sources become available
        updates.forEach((update) => {
          if (update.videoSourceState.type === RemoteVideoUpdateType.Created) {
            this.log('Remote video source available:', update.attendeeId)
          }
        })
      },
      onRemoteVideoSourceUnavailable: (updates: RemoteVideoUpdate[]) => {
        // Called when remote video sources become unavailable
        updates.forEach((update) => {
          if (update.videoSourceState.type === RemoteVideoUpdateType.Destroyed) {
            this.log('Remote video source unavailable:', update.attendeeId)
          }
        })
      },
    }

    this.audioVideo.addVideoTileObserver(videoTileObserver)

    // Realtime observer for participant events
    const realtimeObserver = {
      onAttendeePresenceChange: async (presentAttendees: any[], leftAttendees: any[]) => {
        presentAttendees.forEach((attendee) => {
          if (!this.participantMap.has(attendee.attendeeId)) {
            this.participantMap.set(attendee.attendeeId, attendee.externalUserId)
            this.log('Participant joined:', attendee.attendeeId)
            this.observers.onParticipantJoined?.(attendee.attendeeId, attendee.externalUserId)
          }
        })

        leftAttendees.forEach((attendee) => {
          this.participantMap.delete(attendee.attendeeId)
          this.log('Participant left:', attendee.attendeeId)
          this.observers.onParticipantLeft?.(attendee.attendeeId)
        })
      },
    }

    this.audioVideo.realtimeSubscribeToAttendeeIdPresence(realtimeObserver)
  }

  /**
   * Start meeting session
   */
  async start(): Promise<void> {
    try {
      if (!this.audioVideo) {
        throw new Error('Session not initialized')
      }

      this.log('Starting meeting')
      await this.audioVideo.start()
      this.isJoined = true
      this.log('Meeting started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to start meeting:', errorMessage)
      this.observers.onError?.(new Error(`Meeting start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop meeting session
   */
  async stop(): Promise<void> {
    try {
      if (!this.audioVideo) return

      this.log('Stopping meeting')
      await this.audioVideo.stop()
      this.isJoined = false
      this.log('Meeting stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to stop meeting:', errorMessage)
    }
  }

  /**
   * Start local audio
   */
  async startLocalAudio(): Promise<void> {
    try {
      if (!this.audioVideo) {
        throw new Error('Session not initialized')
      }

      this.log('Starting local audio')
      await this.audioVideo.startLocalAudio()
      this.log('Local audio started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to start local audio:', errorMessage)
      this.observers.onError?.(new Error(`Local audio start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop local audio
   */
  async stopLocalAudio(): Promise<void> {
    try {
      if (!this.audioVideo) return

      this.log('Stopping local audio')
      await this.audioVideo.stopLocalAudio()
      this.log('Local audio stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to stop local audio:', errorMessage)
    }
  }

  /**
   * Start local video
   */
  async startLocalVideo(videoElement?: HTMLVideoElement): Promise<void> {
    try {
      if (!this.audioVideo) {
        throw new Error('Session not initialized')
      }

      this.log('Starting local video')

      if (videoElement) {
        this.localVideoElement = videoElement
      }

      await this.audioVideo.startLocalVideo({
        width: this.config.videoConstraints.width,
        height: this.config.videoConstraints.height,
      })

      // Bind local video stream to element
      if (this.localVideoElement) {
        const videoStream = this.audioVideo.getLocalVideoOutputTile()?.stream()
        if (videoStream) {
          this.localVideoElement.srcObject = videoStream
        }
      }

      this.log('Local video started')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to start local video:', errorMessage)
      this.observers.onError?.(new Error(`Local video start failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Stop local video
   */
  async stopLocalVideo(): Promise<void> {
    try {
      if (!this.audioVideo) return

      this.log('Stopping local video')
      await this.audioVideo.stopLocalVideo()

      if (this.localVideoElement) {
        this.localVideoElement.srcObject = null
      }

      this.log('Local video stopped')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to stop local video:', errorMessage)
    }
  }

  /**
   * Enumerate audio input devices (microphones)
   */
  async enumerateAudioInputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Enumerating audio input devices')
      const devices = await this.deviceController.listAudioInputDevices()

      this.audioInputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log('Found audio input devices:', this.audioInputDevices.length)
      return this.audioInputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to enumerate audio devices:', errorMessage)
      return []
    }
  }

  /**
   * Enumerate video input devices (cameras)
   */
  async enumerateVideoInputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Enumerating video input devices')
      const devices = await this.deviceController.listVideoInputDevices()

      this.videoInputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log('Found video input devices:', this.videoInputDevices.length)
      return this.videoInputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to enumerate video devices:', errorMessage)
      return []
    }
  }

  /**
   * Enumerate audio output devices (speakers)
   */
  async enumerateAudioOutputDevices(): Promise<DeviceInfo[]> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Enumerating audio output devices')
      const devices = await this.deviceController.listAudioOutputDevices()

      this.audioOutputDevices = devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${device.deviceId.slice(0, 5)}`,
        groupId: device.groupId,
      }))

      this.log('Found audio output devices:', this.audioOutputDevices.length)
      return this.audioOutputDevices
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to enumerate audio output devices:', errorMessage)
      return []
    }
  }

  /**
   * Select audio input device (microphone)
   */
  async selectAudioInput(deviceId: string): Promise<void> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Selecting audio input:', deviceId)
      const device = this.audioInputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Audio input device not found: ${deviceId}`)
      }

      await this.deviceController.chooseAudioInputDevice(device)
      this.currentAudioInputId = deviceId
      this.log('Audio input selected:', deviceId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to select audio input:', errorMessage)
      this.observers.onError?.(new Error(`Audio input selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Select video input device (camera)
   */
  async selectVideoInput(deviceId: string): Promise<void> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Selecting video input:', deviceId)
      const device = this.videoInputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Video input device not found: ${deviceId}`)
      }

      await this.deviceController.chooseVideoInputDevice(device)
      this.currentVideoInputId = deviceId
      this.log('Video input selected:', deviceId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to select video input:', errorMessage)
      this.observers.onError?.(new Error(`Video input selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Select audio output device (speaker)
   */
  async selectAudioOutput(deviceId: string): Promise<void> {
    try {
      if (!this.deviceController) {
        throw new Error('Device controller not initialized')
      }

      this.log('Selecting audio output:', deviceId)
      const device = this.audioOutputDevices.find((d) => d.deviceId === deviceId)

      if (!device) {
        throw new Error(`Audio output device not found: ${deviceId}`)
      }

      await this.deviceController.chooseAudioOutputDevice(deviceId)
      this.currentAudioOutputId = deviceId
      this.log('Audio output selected:', deviceId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to select audio output:', errorMessage)
      this.observers.onError?.(new Error(`Audio output selection failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Bind remote video to HTML element
   */
  bindVideoElement(tileId: number, videoElement: HTMLVideoElement): void {
    try {
      if (!this.audioVideo) {
        throw new Error('Session not initialized')
      }

      this.log('Binding video element for tile:', tileId)
      this.audioVideo.bindVideoElement(tileId, videoElement)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to bind video element:', errorMessage)
    }
  }

  /**
   * Unbind video element
   */
  unbindVideoElement(tileId: number, videoElement?: HTMLVideoElement): void {
    try {
      if (!this.audioVideo) return

      this.log('Unbinding video element for tile:', tileId)
      this.audioVideo.unbindVideoElement(tileId, videoElement)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Failed to unbind video element:', errorMessage)
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
      this.audioVideo = null
      this.deviceController = null
      this.isInitialized = false
      this.isJoined = false
      this.participantMap.clear()
      this.videoTileMap.clear()

      this.log('Chime session cleaned up')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log('Error during cleanup:', errorMessage)
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

export type { ChimeObserver, DeviceInfo }
export { ChimeManager }