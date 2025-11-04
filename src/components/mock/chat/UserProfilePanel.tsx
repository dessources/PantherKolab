'use client';

import React from 'react';
import Image from 'next/image';

interface UserProfilePanelProps {
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    bio?: string;
    major?: string;
    year?: string;
    email?: string;
    phone?: string;
    interests?: string[];
  };
  onClose: () => void;
}

export function UserProfilePanel({ user, onClose }: UserProfilePanelProps) {
  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-['Bitter'] text-[#003366]">
            Profile
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close profile"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Avatar and Name */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-3 bg-gray-200">
            <Image
              src={user.avatar}
              alt={user.name}
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-lg font-bold font-['Bitter'] text-[#003366]">
            {user.name}
          </h3>
          <p className="text-sm text-gray-500 font-['Bitter']">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Profile Details */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Bio Section */}
        {user.bio && (
          <div className="mb-6">
            <h4 className="text-sm font-bold font-['Bitter'] text-[#003366] mb-2">
              About
            </h4>
            <p className="text-sm text-gray-700 font-['Bitter']">
              {user.bio}
            </p>
          </div>
        )}

        {/* Academic Info */}
        {(user.major || user.year) && (
          <div className="mb-6">
            <h4 className="text-sm font-bold font-['Bitter'] text-[#003366] mb-2">
              Academic Info
            </h4>
            {user.major && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 font-['Bitter']">Major</p>
                <p className="text-sm text-gray-700 font-['Bitter']">
                  {user.major}
                </p>
              </div>
            )}
            {user.year && (
              <div>
                <p className="text-xs text-gray-500 font-['Bitter']">Year</p>
                <p className="text-sm text-gray-700 font-['Bitter']">
                  {user.year}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Contact Info */}
        {(user.email || user.phone) && (
          <div className="mb-6">
            <h4 className="text-sm font-bold font-['Bitter'] text-[#003366] mb-2">
              Contact
            </h4>
            {user.email && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 font-['Bitter']">Email</p>
                <p className="text-sm text-gray-700 font-['Bitter'] break-all">
                  {user.email}
                </p>
              </div>
            )}
            {user.phone && (
              <div>
                <p className="text-xs text-gray-500 font-['Bitter']">Phone</p>
                <p className="text-sm text-gray-700 font-['Bitter']">
                  {user.phone}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold font-['Bitter'] text-[#003366] mb-2">
              Interests
            </h4>
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[#F8F9FA] rounded-full text-xs font-['Bitter'] text-[#003366] border border-gray-200"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-gray-200">
        <button className="w-full h-12 bg-[#FFC107] hover:bg-[#FFB300] rounded-lg font-['Bitter'] font-semibold text-[#003366] transition-colors mb-3">
          Send Message
        </button>
        <button className="w-full h-12 bg-white hover:bg-gray-50 rounded-lg font-['Bitter'] font-semibold text-[#003366] border border-gray-300 transition-colors">
          Block User
        </button>
      </div>
    </div>
  );
}
