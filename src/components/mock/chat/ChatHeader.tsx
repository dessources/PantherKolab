'use client';

import React from 'react';
import Image from 'next/image';

interface ChatHeaderProps {
  user: {
    name: string;
    avatar: string;
    username: string;
  };
  showProfile: boolean;
  onToggleProfile: () => void;
}

export function ChatHeader({ user, showProfile, onToggleProfile }: ChatHeaderProps) {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left: User Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
          <Image
            src={user.avatar}
            alt={user.name}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h3 className="text-sm font-bold font-['Bitter'] text-[#003366]">
            {user.name}
          </h3>
          <p className="text-xs text-gray-500 font-['Bitter']">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-4">
        {/* Video Call Button */}
        <button
          className="p-2 text-gray-600 hover:text-[#003366] transition-colors"
          aria-label="Start video call"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>

        {/* Audio Call Button */}
        <button
          className="p-2 text-gray-600 hover:text-[#003366] transition-colors"
          aria-label="Start audio call"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>

        {/* Profile Toggle Button */}
        <button
          onClick={onToggleProfile}
          className={`p-2 transition-colors ${
            showProfile
              ? 'text-[#003366] bg-[#F8F9FA]'
              : 'text-gray-600 hover:text-[#003366]'
          }`}
          aria-label="Toggle profile panel"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        {/* More Options */}
        <button
          className="p-2 text-gray-600 hover:text-[#003366] transition-colors"
          aria-label="More options"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
