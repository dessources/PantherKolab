"use client";

import { MessageSquare, Phone, MoreVertical } from "lucide-react";
import Image from "next/image";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  location: string;
  about: string;
  groupsInCommon: string[];
}

interface ProfileSidebarProps {
  profileData: ProfileData | null;
  isVisible: boolean;
  onMessageClick?: () => void;
  onCallClick?: (recipientId: string) => void; // New prop for initiating calls
}

export default function ProfileSidebar({
  profileData,
  isVisible,
  onMessageClick,
  onCallClick,
}: ProfileSidebarProps) {
  const hasData = profileData !== null;

  const actionButtons = [
    {
      icon: <MessageSquare className="w-5 h-5 text-white" />,
      label: "Message",
      onClick: onMessageClick,
    },
    {
      icon: <Phone className="w-5 h-5 text-white" />,
      label: "Audio",
      onClick: () => {
        if (onCallClick && profileData) {
          onCallClick(profileData.id);
        }
      },
    },
    {
      icon: (
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
      label: "Video",
      onClick: () => {
        if (onCallClick && profileData) {
          onCallClick(profileData.id);
        }
      },
    },
    {
      icon: <MoreVertical className="w-5 h-5 text-white" />,
      label: "More",
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      onClick: () => process.env.NODE_ENV !== "production" && console.log("More clicked"), // Placeholder
    },
  ];

  return (
    <div
      className={`transition-all duration-300 ease-in-out bg-white
        ${isVisible && hasData ? "w-96 border-l border-gray-200" : "w-0"}
        lg:flex-shrink-0 lg:relative
        fixed top-0 right-0 h-full z-50 lg:z-auto
        ${isVisible && hasData ? "translate-x-0" : "translate-x-full"}
      `}
    >
      <div className="w-96 h-full flex flex-col overflow-y-auto">
        {profileData && (
          <>
            {/* Cover Photo */}
            <div className="relative h-90">
              <Image
                src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600"
                className="w-full h-full object-cover"
                alt="Cover"
                width={383}
                height={356}
                priority
              />

              {/* Name + Status INSIDE the cover, Sigma style */}
              <div className="absolute bottom-4 left-6 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                <h2 className="text-2xl font-bold capitalize">
                  {profileData.name}
                </h2>

                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-semibold">Online</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 mt-6 grid grid-cols-4 gap-4">
              {actionButtons.map((btn, index) => (
                <button
                  key={index}
                  onClick={btn.onClick}
                  className="flex flex-col items-center gap-2 p-3 bg-white hover:bg-gray-50 rounded-lg transition"
                >
                  <div className="p-3 bg-[#0066CC] rounded-lg">
                    {btn.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {btn.label}
                  </span>
                </button>
              ))}
            </div>

            {/* STATUS SECTION */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">
                STATUS:
              </h3>
              <p className="text-sm font-bold text-gray-900">
                {profileData.status}
              </p>
            </div>

            {/* INFO SECTION */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                INFO:
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Name</p>
                  <p className="text-sm font-bold  text-gray-900 capitalize">
                    {profileData.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Email</p>
                  <p className="text-sm font-bold text-[#0066CC]">
                    {profileData.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Location</p>
                  <p className="text-sm font-bold text-gray-900 ">
                    {profileData.location}
                  </p>
                </div>
              </div>
            </div>

            {/* GROUPS IN COMMON */}
            {profileData.groupsInCommon.length > 0 && (
              <div className="px-6 py-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                  GROUP IN COMMON
                </h3>

                <div className="space-y-4">
                  {profileData.groupsInCommon.map((group, index) => (
                    <div
                      key={index}
                      className="pb-2 border-b last:border-none"
                    >
                      <p className="text-sm font-bold text-gray-900">
                        {group}
                      </p>
                      <div className="h-[3px] bg-[#FFB300] mt-2 w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABOUT ME */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                ABOUT ME
              </h3>

              <p className="text-sm font-bold text-gray-900 leading-relaxed">
                {profileData.about}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}