"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  UserPlus,
  MessageSquareText,
  Phone,
  LogOut,
  Hand,
  EllipsisVertical,
} from "lucide-react";
import { MoreOptionsModal } from "./MoreOptionsModal";
import { useCallTimer } from "@/hooks/useCallTimer";

interface MeetingControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isHandRaised?: boolean;
  isScreenSharing?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleRaiseHand?: () => void;
  onAddParticipant?: () => void;
  onShareScreen?: () => void;
  onToggleChat?: () => void;
  isCallOwner?: boolean;
  onEndCall: () => void;
  onLeaveCall?: () => void;
}

export function MeetingControls({
  isMuted,
  isVideoEnabled,
  isHandRaised = false,
  isScreenSharing = false,
  onToggleMute,
  onToggleVideo,
  onToggleRaiseHand,
  onAddParticipant,
  onShareScreen,
  onToggleChat,
  isCallOwner,
  onEndCall,
  onLeaveCall,
}: MeetingControlsProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const callTime = useCallTimer(true); // Timer is always active when controls are shown

  return (
    <>
      <div className="bg-white border-t border-gray-200 px-16 sm:px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Left Controls - Audio/Video */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Microphone Button */}
            <button
              onClick={onToggleMute}
              className={`p-4 rounded-lg transition-all cursor-pointer ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[#00376f] hover:bg-[#0052A3] text-white"
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Video Button */}
            <button
              onClick={onToggleVideo}
              className={`p-4 rounded-lg transition-all cursor-pointer ${
                !isVideoEnabled
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[#00376f] hover:bg-[#0052A3] text-white"
              }`}
              aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {!isVideoEnabled ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Center Controls - Add Participant/Screen Share/Raise Hand/Chat */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Add Participant Button - only for call owner, hidden on mobile */}
            {isCallOwner && (
              <button
                onClick={onAddParticipant}
                className="hidden sm:block p-4 rounded-lg bg-[#00376f] hover:bg-[#0052A3] transition-colors cursor-pointer"
                aria-label="Add participant"
              >
                <UserPlus className="w-5 h-5 text-white" />
              </button>
            )}

            {/* Screen Share Button - hidden on mobile */}
            <button
              onClick={onShareScreen}
              className={`hidden sm:block p-4 rounded-lg transition-colors cursor-pointer ${
                isScreenSharing
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-[#00376f] hover:bg-[#0052A3] text-white"
              }`}
              aria-label={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                  strokeWidth="2"
                />
                <path d="M8 21h8" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 17v4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Raise Hand Button - always visible */}
            <button
              onClick={onToggleRaiseHand}
              className={`p-4 rounded-lg transition-colors cursor-pointer ${
                isHandRaised
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : "bg-[#00376f] hover:bg-[#0052A3] text-white"
              }`}
              aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
            >
              <Hand className="w-5 h-5" />
            </button>

            {/* Chat Button - hidden on mobile */}
            <button
              onClick={onToggleChat}
              className="hidden sm:block p-4 rounded-lg bg-[#00376f] hover:bg-[#0052A3] transition-colors cursor-pointer"
              aria-label="Toggle chat"
            >
              <MessageSquareText className="w-5 h-5 text-white" />
            </button>

            {/* More Options Button - visible on mobile only */}
            <button
              onClick={() => setShowMoreOptions(true)}
              className="p-4 rounded-lg bg-[#00376f] hover:bg-[#0052A3] transition-colors cursor-pointer sm:hidden"
              aria-label="More options"
            >
              <EllipsisVertical className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Right Controls - Timer + Leave/End Call */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Call Timer */}
            <div className="hidden sm:flex items-center px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-gray-700 font-mono font-medium text-sm">
                {callTime}
              </span>
            </div>

            {/* Leave Call Button - shown to non-owners, hidden on mobile */}
            {onLeaveCall && !isCallOwner && (
              <button
                onClick={onLeaveCall}
                className="hidden sm:flex p-4 sm:px-6 sm:py-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white items-center gap-2 transition-colors font-medium cursor-pointer"
                aria-label="Leave call"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}

            {/* Leave Call Button for non-owners on mobile */}
            {onLeaveCall && !isCallOwner && (
              <button
                onClick={onLeaveCall}
                className="sm:hidden p-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2 transition-colors font-medium cursor-pointer"
                aria-label="Leave call"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}

            {/* End Call Button - shown to call owners only */}
            {isCallOwner && (
              <button
                onClick={onEndCall}
                className="p-4 sm:px-6 sm:py-4 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 transition-colors font-medium cursor-pointer"
                aria-label="End call for everyone"
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
                <span className="hidden sm:inline">End</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* More Options Modal */}
      <MoreOptionsModal
        isOpen={showMoreOptions}
        onClose={() => setShowMoreOptions(false)}
        isCallOwner={isCallOwner || false}
        onAddParticipant={onAddParticipant}
        onShareScreen={onShareScreen}
        onToggleChat={onToggleChat}
      />
    </>
  );
}
