"use client";

import { useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { MeetingHeader } from "./MeetingHeader";
import { ParticipantTile } from "./ParticipantTile";
import { ParticipantStrip } from "./ParticipantStrip";
import { ScreenShareView } from "./ScreenShareView";
import { WhiteboardInCallView } from "./WhiteboardInCallView";
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
  conversationId?: string | null;
  activeWhiteboard?: {
    whiteboardId: string;
    whiteboardName: string;
    snapshot: string | null;
    openedBy: string;
  } | null;
  onEndCall: () => void;
  onLeaveCall?: () => void;
  onOpenWhiteboard?: (whiteboardId: string) => void;
  onCloseWhiteboard?: () => void;
  onSettingsClick?: () => void;
}

export function MeetingView({
  meetingTitle,
  meetingSubtitle,
  participants: mockParticipants,
  activeSpeakerId: mockActiveSpeakerId,
  isCallOwner,
  localUserId,
  meeting,
  attendee,
  participantNames = {},
  conversationId,
  activeWhiteboard,
  onEndCall,
  onLeaveCall,
  onOpenWhiteboard,
  onCloseWhiteboard,
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
    isScreenSharing,
    contentTileId,
    startScreenShare,
    stopScreenShare,
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

  // Separate content share from regular participant tiles
  const contentTile = useMemo(() => {
    return videoTiles.find((tile) => tile.isContent);
  }, [videoTiles]);

  const participantVideoTiles = useMemo(() => {
    return videoTiles.filter((tile) => !tile.isContent);
  }, [videoTiles]);

  // Map video tiles to participants (memoized to prevent recreation)
  const participants = useMemo(() => {
    return participantVideoTiles.map((tile) => {
      // Get display name from participantNames map, fallback to userId or "Unknown"
      const displayName = tile.isLocalTile
        ? "You"
        : localUserId
        ? participantNames[localUserId]
        : "Unknown";

      return {
        id: tile.attendeeId,
        name: displayName,
        isLocal: tile.isLocalTile,
        isMuted: tile.isLocalTile ? isMuted : false,
        hasVideo: true,
        tileId: tile.tileId,
      };
    });
  }, [participantVideoTiles, localUserId, participantNames, isMuted]);

  // Use mock participants if no real tiles yet (for testing)
  const displayParticipants =
    participants.length > 0 ? participants : mockParticipants || [];
  const displayActiveSpeakerId = activeSpeakerId || mockActiveSpeakerId;

  // Calculate grid layout based on participant count
  const participantCount = displayParticipants.length;
  const getGridClasses = () => {
    if (participantCount === 1) return "grid-cols-1";
    if (participantCount === 2) return "grid-cols-1 lg:grid-cols-2";
    if (participantCount === 3)
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    if (participantCount === 4) return "grid-cols-1 sm:grid-cols-2";
    // 5+ participants: use standard responsive grid
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  };

  // Check if screen sharing is active
  const isScreenShareActive = !!contentTile;

  // Check if whiteboard is active
  const isWhiteboardActive = !!activeWhiteboard;

  // Debug logging
  console.log("[MeetingView] activeWhiteboard:", activeWhiteboard);
  console.log("[MeetingView] isWhiteboardActive:", isWhiteboardActive);

  // Determine what to show in main content area
  const shouldShowScreenShare = isScreenShareActive && !isWhiteboardActive;
  const shouldShowWhiteboard = isWhiteboardActive;
  const shouldShowGrid = !shouldShowScreenShare && !shouldShowWhiteboard;

  console.log("[MeetingView] shouldShowWhiteboard:", shouldShowWhiteboard);
  console.log("[MeetingView] shouldShowScreenShare:", shouldShowScreenShare);
  console.log("[MeetingView] shouldShowGrid:", shouldShowGrid);

  // Handle whiteboard toggle - create new or open existing
  const handleWhiteboardToggle = useCallback(async () => {
    if (isWhiteboardActive) {
      // Close active whiteboard
      onCloseWhiteboard?.();
    } else {
      // Need to create or open whiteboard
      const default_conversationId = "ee4f1426-5f14-4f3d-b01a-216f8805306a";

      if (!default_conversationId) {
        toast.error("Whiteboard requires a conversation context");
        return;
      }

      try {
        // Check if whiteboard exists for this conversation
        const response = await fetch(
          `/api/whiteboards/list?conversationId=${default_conversationId}`
        );

        if (!response.ok) {
          throw new Error("Failed to check for existing whiteboards");
        }

        const data = await response.json();
        const whiteboards = data.whiteboards || [];

        if (whiteboards.length > 0) {
          // Open the first (most recent) whiteboard
          onOpenWhiteboard?.(whiteboards[0].whiteboardId);
        } else {
          // Create a new whiteboard
          const createResponse = await fetch("/api/whiteboards/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: default_conversationId,
              name: `Call Whiteboard - ${new Date().toLocaleString()}`,
            }),
          });

          if (!createResponse.ok) {
            throw new Error("Failed to create whiteboard");
          }

          const newWhiteboard = await createResponse.json();
          onOpenWhiteboard?.(newWhiteboard.whiteboardId);
        }
      } catch (error) {
        console.error("Error with whiteboard:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to manage whiteboard"
        );
      }
    }
  }, [isWhiteboardActive, onCloseWhiteboard, onOpenWhiteboard]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Hidden audio element for Chime SDK */}
      <audio id="chime-audio-output" className="hidden" />

      {/* Header with responsive padding */}
      <div className="px-0 md:px-8 lg:px-0 xl:px-0">
        <MeetingHeader
          title={meetingTitle}
          subtitle={meetingSubtitle}
          onSettingsClick={onSettingsClick}
        />
      </div>

      {/* Content area - conditional layout */}
      {shouldShowWhiteboard ? (
        /* Whiteboard Layout */
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Top strip: Horizontal scrolling participant tiles (1/5 height) */}
          <ParticipantStrip
            participants={
              participants as Array<Participant & { tileId: number }>
            }
            activeSpeakerId={displayActiveSpeakerId}
            onVideoElementReady={handleVideoElementReady}
          />

          {/* Bottom area: Whiteboard (4/5 height) */}
          <WhiteboardInCallView
            whiteboardId={activeWhiteboard!.whiteboardId}
            currentUserId={localUserId || ""}
            initialSnapshot={activeWhiteboard!.snapshot}
            isCreator={activeWhiteboard!.openedBy === localUserId}
            onClose={onCloseWhiteboard || (() => {})}
          />
        </div>
      ) : shouldShowScreenShare && contentTile ? (
        /* Screen Share Layout */
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Top strip: Horizontal scrolling participant tiles (1/5 height) */}
          <ParticipantStrip
            participants={
              participants as Array<Participant & { tileId: number }>
            }
            activeSpeakerId={displayActiveSpeakerId}
            onVideoElementReady={handleVideoElementReady}
          />

          {/* Bottom area: Shared screen (4/5 height) */}
          <ScreenShareView
            contentTile={contentTile}
            onVideoElementReady={handleVideoElementReady}
          />
        </div>
      ) : shouldShowGrid ? (
        /* Normal Grid Layout */
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4 md:px-8 lg:px-16 xl:px-24 lg:py-6">
          <div
            className={`w-full h-full ${
              participantCount <= 4 ? "max-w-full" : "max-w-7xl"
            }`}
          >
            <div
              className={`grid ${getGridClasses()} gap-3 lg:gap-4 h-full ${
                participantCount <= 4 ? "content-center" : ""
              }`}
            >
              {displayParticipants.map((participant) => (
                <ParticipantTile
                  key={participant.id}
                  name={participant.name}
                  isLocal={participant.isLocal}
                  isActiveSpeaker={displayActiveSpeakerId === participant.id}
                  isMuted={participant.isMuted}
                  hasVideo={participant.hasVideo}
                  isScreenShareActive={isScreenShareActive}
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
      ) : null}

      {/* Controls with responsive padding */}
      <div className="px-0 md:px-8 lg:px-0 xl:px-0">
        <MeetingControls
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          isCallOwner={isCallOwner}
          onEndCall={onEndCall}
          onLeaveCall={onLeaveCall}
          isScreenSharing={isScreenSharing}
          onShareScreen={isScreenSharing ? stopScreenShare : startScreenShare}
          hasActiveWhiteboard={isWhiteboardActive}
          onToggleWhiteboard={handleWhiteboardToggle}
        />
      </div>
    </div>
  );
}
