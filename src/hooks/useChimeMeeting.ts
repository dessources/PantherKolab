import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
  VideoTileState,
  MeetingSessionStatus,
  MeetingSessionStatusCode,
} from "amazon-chime-sdk-js";
import type { Meeting, Attendee } from "@aws-sdk/client-chime-sdk-meetings";
import { soundEffects } from "@/lib/sounds/soundEffects";

interface UseChimeMeetingProps {
  meeting: Meeting | null;
  attendee: Attendee | null;
  onError?: (error: Error) => void;
}

interface VideoTileInfo {
  tileId: number;
  attendeeId: string;
  isLocalTile: boolean;
  isContent: boolean;
}

export function useChimeMeeting({
  meeting,
  attendee,
  onError,
}: UseChimeMeetingProps) {
  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [videoTiles, setVideoTiles] = useState<Map<number, VideoTileInfo>>(
    new Map()
  );
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasStartedAudioVideoRef = useRef(false);

  // Initialize meeting session
  useEffect(() => {
    if (!meeting || !attendee) {
      return;
    }

    const logger = new ConsoleLogger("ChimeMeeting", LogLevel.INFO);
    const deviceController = new DefaultDeviceController(logger);

    try {
      const configuration = new MeetingSessionConfiguration(meeting, attendee);
      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );

      meetingSessionRef.current = meetingSession;

      // Set up observers
      const audioVideoObserver = {
        videoTileDidUpdate: (tileState: VideoTileState) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          process.env.NODE_ENV !== "production" &&
            console.log("Video tile updated:", tileState);
          if (!tileState.boundAttendeeId) {
            return;
          }

          setVideoTiles((prevTiles) => {
            const newTiles = new Map(prevTiles);
            newTiles.set(tileState.tileId!, {
              tileId: tileState.tileId!,
              attendeeId: tileState.boundAttendeeId!,
              isLocalTile: tileState.localTile,
              isContent: tileState.isContent,
            });
            return newTiles;
          });
        },

        videoTileWasRemoved: (tileId: number) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          process.env.NODE_ENV !== "production" &&
            console.log("Video tile removed:", tileId);
          setVideoTiles((prevTiles) => {
            const newTiles = new Map(prevTiles);
            newTiles.delete(tileId);
            return newTiles;
          });
        },

        audioVideoDidStart: () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          process.env.NODE_ENV !== "production" &&
            console.log("Audio/Video started");
        },

        audioVideoDidStop: (sessionStatus: MeetingSessionStatus) => {
          const sessionStatusCode = sessionStatus.statusCode();
          if (sessionStatusCode === MeetingSessionStatusCode.MeetingEnded) {
            // This is a normal meeting end. No need to show an error.
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            process.env.NODE_ENV !== "production" &&
              console.log("[ChimeMeeting] The meeting has ended normally.");
            // The onCallEnded callback in useCalls will handle UI changes.
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            process.env.NODE_ENV !== "production" &&
              console.log(
                "[ChimeMeeting] Audio/Video stopped with status:",
                sessionStatus.statusCode()
              );
          }
        },
      };

      meetingSession.audioVideo.addObserver(audioVideoObserver);

      // Set up active speaker detection
      const activeSpeakerCallback = (attendeeIds: string[]) => {
        if (attendeeIds.length > 0) {
          setActiveSpeakerId(attendeeIds[0]);
        }
      };

      meetingSession.audioVideo.subscribeToActiveSpeakerDetector(
        new DefaultActiveSpeakerPolicy(),
        activeSpeakerCallback
      );

      setIsInitialized(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
        console.log("✅ Chime meeting session initialized");
    } catch (error) {
      console.error("Error initializing Chime meeting:", error);
      onError?.(error as Error);
    }

    // Cleanup on unmount
    return () => {
      if (meetingSessionRef.current) {
        meetingSessionRef.current.audioVideo.stop();
        setIsInitialized(false);
        hasStartedAudioVideoRef.current = false; // Reset flag on cleanup
      }
    };
  }, [meeting, attendee, onError]);

  // Start audio and video
  const startAudioVideo = useCallback(async () => {
    const meetingSession = meetingSessionRef.current;
    if (!meetingSession) {
      console.error("Meeting session not initialized");
      return;
    }

    // Guard: Prevent starting multiple times
    if (hasStartedAudioVideoRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
        console.log("Audio/video already started, skipping");
      return;
    }

    try {
      hasStartedAudioVideoRef.current = true;

      // Get audio and video input devices
      const audioInputDevices =
        await meetingSession.audioVideo.listAudioInputDevices();
      const videoInputDevices =
        await meetingSession.audioVideo.listVideoInputDevices();

      if (audioInputDevices.length > 0) {
        await meetingSession.audioVideo.startAudioInput(
          audioInputDevices[0].deviceId
        );
      }

      if (videoInputDevices.length > 0) {
        await meetingSession.audioVideo.startVideoInput(
          videoInputDevices[0].deviceId
        );
      }

      // Bind audio output
      const audioOutputElement = document.getElementById(
        "chime-audio-output"
      ) as HTMLAudioElement;
      if (audioOutputElement) {
        await meetingSession.audioVideo.bindAudioElement(audioOutputElement);
      }

      // Start the session
      meetingSession.audioVideo.start();

      // Start local video
      meetingSession.audioVideo.startLocalVideoTile();
      setIsVideoEnabled(true);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
        console.log("✅ Audio and video started");
    } catch (error) {
      console.error("Error starting audio/video:", error);
      hasStartedAudioVideoRef.current = false; // Reset on error
      onError?.(error as Error);
    }
  }, [onError]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const meetingSession = meetingSessionRef.current;
    if (!meetingSession) return;

    const shouldMute = !isMuted;
    if (shouldMute) {
      meetingSession.audioVideo.realtimeMuteLocalAudio();
    } else {
      meetingSession.audioVideo.realtimeUnmuteLocalAudio();
    }
    setIsMuted(shouldMute);
    soundEffects.play("mic-toggle");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log(shouldMute ? "🔇 Muted" : "🔊 Unmuted");
  }, [isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const meetingSession = meetingSessionRef.current;
    if (!meetingSession) return;

    const shouldDisable = isVideoEnabled;
    if (shouldDisable) {
      meetingSession.audioVideo.stopLocalVideoTile();
      setIsVideoEnabled(false);
      soundEffects.play("camera-toggle");
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" && console.log("📹 Video disabled");
    } else {
      meetingSession.audioVideo.startLocalVideoTile();
      setIsVideoEnabled(true);
      soundEffects.play("camera-toggle");
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" && console.log("📹 Video enabled");
    }
  }, [isVideoEnabled]);

  // Bind video tile to HTML element
  const bindVideoTile = useCallback(
    (tileId: number, videoElement: HTMLVideoElement) => {
      const meetingSession = meetingSessionRef.current;
      if (!meetingSession) return;

      meetingSession.audioVideo.bindVideoElement(tileId, videoElement);
      console.log(`📺 Video tile ${tileId} bound to element`);
    },
    []
  );

  // Memoize videoTiles array to prevent recreation on every render
  const videoTilesArray = useMemo(() => {
    return Array.from(videoTiles.values());
  }, [videoTiles]);

  return {
    meetingSession: meetingSessionRef.current,
    isInitialized,
    isMuted,
    isVideoEnabled,
    videoTiles: videoTilesArray,
    activeSpeakerId,
    startAudioVideo,
    toggleMute,
    toggleVideo,
    bindVideoTile,
  };
}

// Default active speaker policy
class DefaultActiveSpeakerPolicy {
  calculateScore(
    attendeeId: string,
    volume: number | null,
    muted: boolean | null
  ): number {
    if (muted || volume === null) {
      return 0;
    }
    return volume;
  }

  prioritizeVideoSendBandwidthForActiveSpeaker(): boolean {
    return true;
  }
}
