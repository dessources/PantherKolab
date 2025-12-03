"use client";

import { useState } from "react";
import { MeetingHeader } from "./MeetingHeader";
import { ParticipantTileDev } from "./ParticipantTileDev";
import { MeetingControls } from "./MeetingControls";
import { EndCallModal } from "./EndCallModal";
import { LeaveCallModal } from "./LeaveCallModal";

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  avatarColor?: string;
}

interface MeetingViewDevProps {
  meetingTitle: string;
  meetingSubtitle?: string;
  isCallOwner?: boolean;
  onEndCall: () => void;
  onLeaveCall?: () => void;
  onSettingsClick?: () => void;
}

// Mock participants for development
// const MOCK_PARTICIPANTS: Participant[] = [
//   {
//     id: "local-user",
//     name: "You",
//     isLocal: true,
//     isMuted: false,
//     hasVideo: true,
//     avatarColor: "#0066CC",
//   },
//   {
//     id: "user-2",
//     name: "Maria Garcia",
//     isLocal: false,
//     isMuted: false,
//     hasVideo: true,
//     avatarColor: "#B6862C",
//   },
//   {
//     id: "user-3",
//     name: "James Wilson",
//     isLocal: false,
//     isMuted: true,
//     hasVideo: false,
//     avatarColor: "#003366",
//   },
// ];

/**
 * MeetingViewDev - Development version of MeetingView
 *
 * This component mirrors the production MeetingView but uses mock data
 * instead of actual Chime SDK integration, allowing for UI development
 * and testing without a real meeting session.
 */
export function MeetingViewDev({
  meetingTitle,
  meetingSubtitle,
  isCallOwner = false,
  onEndCall,
  onLeaveCall,
  onSettingsClick,
}: MeetingViewDevProps) {
  // Local state for controls (no Chime integration)
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>("user-2");

  // Modal states
  const [showEndCallModal, setShowEndCallModal] = useState(false);
  const [showLeaveCallModal, setShowLeaveCallModal] = useState(false);

  // Toggle mute (updates local participant)
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isMuted: !isMuted } : p))
    );
  };

  // Toggle video (updates local participant)
  const handleToggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, hasVideo: !isVideoEnabled } : p))
    );
  };

  // Toggle raise hand
  const handleToggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);
  };

  // Handle end call button click
  const handleEndCallClick = () => {
    if (isCallOwner) {
      setShowEndCallModal(true);
    }
  };

  // Handle leave call button click
  const handleLeaveCallClick = () => {
    if (!isCallOwner) {
      setShowLeaveCallModal(true);
    }
  };

  // Handle actual end call
  const handleConfirmEndCall = () => {
    setShowEndCallModal(false);
    onEndCall();
  };

  // Handle leave with ownership transfer
  const handleLeaveWithTransfer = (newOwnerId: string) => {
    setShowEndCallModal(false);
    console.log("Transferring ownership to:", newOwnerId);
    // In production, this would pass newOwnerId in the PARTICIPANT_LEFT payload
    onLeaveCall?.();
  };

  // Handle confirm leave (non-owner)
  const handleConfirmLeave = () => {
    setShowLeaveCallModal(false);
    onLeaveCall?.();
  };

  // Add a mock participant (for testing)
  const addParticipant = () => {
    const names = [
      "Alex Chen",
      "Sarah Johnson",
      "Mike Brown",
      "Emma Davis",
      "Chris Lee",
    ];
    const colors = ["#4CAF50", "#9C27B0", "#FF5722", "#00BCD4", "#795548"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newParticipant: Participant = {
      id: `user-${Date.now()}`,
      name: randomName,
      isLocal: false,
      isMuted: Math.random() > 0.5,
      hasVideo: Math.random() > 0.3,
      avatarColor: randomColor,
    };

    setParticipants((prev) => [...prev, newParticipant]);
  };

  // Remove last non-local participant (for testing)
  const removeParticipant = () => {
    setParticipants((prev) => {
      const nonLocal = prev.filter((p) => !p.isLocal);
      if (nonLocal.length === 0) return prev;
      return prev.slice(0, -1);
    });
  };

  // Cycle active speaker (for testing)
  const cycleActiveSpeaker = () => {
    const nonLocal = participants.filter((p) => !p.isLocal);
    if (nonLocal.length === 0) {
      setActiveSpeakerId("");
      return;
    }

    const currentIndex = nonLocal.findIndex((p) => p.id === activeSpeakerId);
    const nextIndex = (currentIndex + 1) % nonLocal.length;
    setActiveSpeakerId(nonLocal[nextIndex].id);
  };

  // Get local user ID
  const localUserId = participants.find((p) => p.isLocal)?.id || "local-user";

  // Render participant tile
  const renderParticipantTile = (participant: Participant) => (
    <ParticipantTileDev
      key={participant.id}
      name={participant.name}
      isLocal={participant.isLocal}
      isActiveSpeaker={activeSpeakerId === participant.id}
      isMuted={participant.isMuted}
      hasVideo={participant.hasVideo}
      avatarColor={participant.avatarColor}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      {/* Header */}
      <MeetingHeader
        title={meetingTitle}
        subtitle={meetingSubtitle}
        onSettingsClick={onSettingsClick}
      />

      {/* Dev Controls Banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm text-yellow-800 font-medium">
            Development Mode - No Chime Integration
          </span>
          <div className="flex gap-2">
            <button
              onClick={addParticipant}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              + Add Participant
            </button>
            <button
              onClick={removeParticipant}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              - Remove
            </button>
            <button
              onClick={cycleActiveSpeaker}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              Cycle Speaker
            </button>
          </div>
        </div>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className="h-full max-w-7xl mx-auto flex items-center justify-center">
          {/* 
          Dynamic grid based on participant count 
          */}
          {participants.length === 0 ? (
            /* Empty State */
            <div className="flex items-center justify-center py-20">
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
          ) : (
            <>
              {/* Mobile view - always use scrollable grid */}
              <div className="sm:hidden w-full h-full overflow-y-auto">
                <div className="grid grid-cols-1 gap-4">
                  {participants.map(renderParticipantTile)}
                </div>
              </div>

              {/* Desktop view - dynamic layout based on count */}
              <div className="hidden sm:flex w-full h-full items-center justify-center">
                {participants.length === 1 ? (
                  /* Single tile - takes full space */
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-full max-w-4xl aspect-video">
                      {renderParticipantTile(participants[0])}
                    </div>
                  </div>
                ) : participants.length === 2 ? (
                  /* Two tiles - side by side */
                  <div className="w-full h-full flex items-center justify-center gap-4">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex-1 max-w-2xl aspect-video"
                      >
                        {renderParticipantTile(participant)}
                      </div>
                    ))}
                  </div>
                ) : participants.length <= 4 ? (
                  /* 3-4 tiles - 2x2 grid */
                  <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-4">
                    {participants.map((participant, index) => (
                      <div
                        key={participant.id}
                        className={`flex min-h-0 w-full ${
                          index % 2 === 0 ? "justify-end" : "justify-start"
                        } ${index < 2 ? "items-end" : "items-start"}`}
                      >
                        <div className="h-full flex max-w-full aspect-video ">
                          {renderParticipantTile(participant)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* 5+ tiles - standard responsive grid */
                  <div className="w-full h-full overflow-y-auto">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {participants.map(renderParticipantTile)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <MeetingControls
        isMuted={isMuted}
        isVideoEnabled={isVideoEnabled}
        isHandRaised={isHandRaised}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleRaiseHand={handleToggleRaiseHand}
        isCallOwner={isCallOwner}
        onEndCall={handleEndCallClick}
        onLeaveCall={handleLeaveCallClick}
      />

      {/* End Call Modal (for call owners) */}
      <EndCallModal
        isOpen={showEndCallModal}
        onClose={() => setShowEndCallModal(false)}
        onEndCall={handleConfirmEndCall}
        onLeaveCall={handleLeaveWithTransfer}
        participants={participants.map((p) => ({ id: p.id, name: p.name }))}
        currentUserId={localUserId}
      />

      {/* Leave Call Modal (for non-owners) */}
      <LeaveCallModal
        isOpen={showLeaveCallModal}
        onClose={() => setShowLeaveCallModal(false)}
        onConfirm={handleConfirmLeave}
      />
    </div>
  );
}
