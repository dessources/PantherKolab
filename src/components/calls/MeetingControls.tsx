"use client"

import { Mic, MicOff, Video, VideoOff, Users, UserPlus, MessageSquare, Phone, LogOut } from 'lucide-react'

interface MeetingControlsProps {
  isMuted: boolean
  isVideoEnabled: boolean
  onToggleMute: () => void
  onToggleVideo: () => void
  onToggleParticipants?: () => void
  onToggleChat?: () => void
  onInviteUsers?: () => void
  isCallOwner?: boolean
  onEndCall: () => void
  onLeaveCall?: () => void
}

export function MeetingControls({
  isMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
  onToggleParticipants,
  onToggleChat,
  onInviteUsers,
  isCallOwner,
  onEndCall,
  onLeaveCall,
}: MeetingControlsProps) {
  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Controls - Audio/Video */}
        <div className="flex items-center gap-3">
          {/* Microphone Button */}
          <button
            onClick={onToggleMute}
            className={`p-4 rounded-lg transition-all ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#0066CC] hover:bg-[#0052A3] text-white'
            }`}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Button */}
          <button
            onClick={onToggleVideo}
            className={`p-4 rounded-lg transition-all ${
              !isVideoEnabled
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#0066CC] hover:bg-[#0052A3] text-white'
            }`}
            aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>

        {/* Center Controls - Participants/Chat/Invite */}
        <div className="flex items-center gap-3">
          {/* Participants Button */}
          {onToggleParticipants && (
            <button
              onClick={onToggleParticipants}
              className="p-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Toggle participants"
            >
              <Users className="w-5 h-5 text-[#0066CC]" />
            </button>
          )}

          {/* Invite Button */}
          {onInviteUsers && (
            <button
              onClick={onInviteUsers}
              className="p-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Invite users"
            >
              <UserPlus className="w-5 h-5 text-[#0066CC]" />
            </button>
          )}

          {/* Screen Share Button */}
          <button
            className="p-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Share screen"
          >
            <svg className="w-5 h-5 text-[#0066CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
              <path d="M8 21h8" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 17v4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Chat Button */}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="p-4 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Toggle chat"
            >
              <MessageSquare className="w-5 h-5 text-[#0066CC]" />
            </button>
          )}
        </div>

        {/* Right Controls - Leave/End Call */}
        <div className="flex items-center gap-3">
          {/* Leave Call Button - shown to all users */}
          {onLeaveCall && (
            <button
              onClick={onLeaveCall}
              className="px-6 py-4 rounded-lg bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2 transition-colors font-medium"
              aria-label="Leave call"
            >
              <LogOut className="w-5 h-5" />
              <span>Leave</span>
            </button>
          )}

          {/* End Call Button - shown to call owners only */}
          {isCallOwner && (
            <button
              onClick={onEndCall}
              className="px-6 py-4 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 transition-colors font-medium"
              aria-label="End call for everyone"
            >
              <Phone className="w-5 h-5 rotate-[135deg]" />
              <span>End</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
