"use client";

import { useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { MeetingHeader } from "./MeetingHeader";
import { ParticipantTile } from "./ParticipantTile";
import { MeetingControls } from "./MeetingControls";
import { useChimeMeeting } from "@/hooks/useChimeMeeting";
import type { Meeting, Attendee } from "@aws-sdk/client-chime-sdk-meetings";

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  hasVideo: boolean;
}

interface MeetingViewProps {
  meetingTitle: string;
  meetingSubtitle?: string;
  participants?: Participant[];
  activeSpeakerId?: string;
  isCallOwner?: boolean;
  meeting?: Meeting;
  attendee?: Attendee;
  localUserId?: string;
  participantNames?: { [userId: string]: string }; // Map of userId to display name
  onEndCall: () => void;
  onLeaveCall?: () => void;
  onSettingsClick?: () => void;
}

export function MeetingView({
  meetingTitle,
  meetingSubtitle,
  participants: mockParticipants,
  activeSpeakerId: mockActiveSpeakerId,
  isCallOwner,
  meeting,
  attendee,
  participantNames = {},
  onEndCall,
  onLeaveCall,
  onSettingsClick,
}: MeetingViewProps) {
  // Memoize error handler to prevent recreating on every render
  const handleError = useCallback((error: Error) => {
    console.error("Chime meeting error:", error);
    toast.error("Meeting error: " + error.message);
  }, []);

  const {
    isInitialized,
    isMuted,
    isVideoEnabled,
    videoTiles,
    activeSpeakerId,
    startAudioVideo,
    toggleMute,
    toggleVideo,
    bindVideoTile,
  } = useChimeMeeting({
    meeting: meeting || null,
    attendee: attendee || null,
    onError: handleError,
  });

  // Start audio/video when initialized
  useEffect(() => {
    if (isInitialized) {
      startAudioVideo();
    }
  }, [isInitialized, startAudioVideo]);

  // Callback to bind video tiles
  const handleVideoElementReady = useCallback(
    (tileId: number, element: HTMLVideoElement) => {
      bindVideoTile(tileId, element);
    },
    [bindVideoTile]
  );

  // Map video tiles to participants (memoized to prevent recreation)
  const participants = useMemo(() => {
    return videoTiles.map((tile) => {
      // Extract userId from attendeeId (format: "userId#sessionId" or just "userId")
      const userId = tile.attendeeId.split("#")[0];

      // Get display name from participantNames map, fallback to userId or "Unknown"
      const displayName = tile.isLocalTile
        ? "You"
        : participantNames[userId] || userId || "Unknown";

      return {
        id: tile.attendeeId,
        name: displayName,
        isLocal: tile.isLocalTile,
        isMuted: tile.isLocalTile ? isMuted : false,
        hasVideo: true,
        tileId: tile.tileId,
      };
    });
  }, [videoTiles, isMuted, participantNames]);

  // Use mock participants if no real tiles yet (for testing)
  const displayParticipants =
    participants.length > 0 ? participants : mockParticipants || [];
  const displayActiveSpeakerId = activeSpeakerId || mockActiveSpeakerId;

  // Calculate grid layout based on participant count
  const participantCount = displayParticipants.length;
  const getGridClasses = () => {
    if (participantCount === 1) return "grid-cols-1";
    if (participantCount === 2) return "grid-cols-1 lg:grid-cols-2";
    if (participantCount === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    if (participantCount === 4) return "grid-cols-1 sm:grid-cols-2";
    // 5+ participants: use standard responsive grid
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Hidden audio element for Chime SDK */}
      <audio id="chime-audio-output" className="hidden" />

      {/* Header */}
      <MeetingHeader
        title={meetingTitle}
        subtitle={meetingSubtitle}
        onSettingsClick={onSettingsClick}
      />

      {/* Participants Grid */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 lg:p-6">
        <div className={`w-full h-full ${participantCount <= 4 ? 'max-w-full' : 'max-w-7xl'}`}>
          <div className={`grid ${getGridClasses()} gap-3 lg:gap-4 h-full ${participantCount <= 4 ? 'content-center' : ''}`}>
            {displayParticipants.map((participant) => (
              <ParticipantTile
                key={participant.id}
                name={participant.name}
                isLocal={participant.isLocal}
                isActiveSpeaker={displayActiveSpeakerId === participant.id}
                isMuted={participant.isMuted}
                hasVideo={participant.hasVideo}
                tileId={
                  (participant as Participant & { tileId: number }).tileId
                }
                onVideoElementReady={handleVideoElementReady}
              />
            ))}

            {/* Empty State */}
            {participants.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">
                    Waiting for others to join...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <MeetingControls
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        isCallOwner={isCallOwner}
        onEndCall={onEndCall}
        onLeaveCall={onLeaveCall}
      />
    </div>
  );
}
