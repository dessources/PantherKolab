"use client";

import { Settings } from "lucide-react";

interface MeetingHeaderProps {
  title: string;
  subtitle?: string;
  onSettingsClick?: () => void;
}

export function MeetingHeader({
  title,
  subtitle,
  onSettingsClick,
}: MeetingHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 lg:px-16 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="w-12 h-12 bg-[#003366] rounded flex items-center justify-center">
          <span className="text-white font-bold text-lg">PK</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-[#B6862C]">{subtitle}</p>}
        </div>
      </div>

      {/* Settings Button */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-6 h-6 text-[#0066CC]" />
        </button>
      )}
    </div>
  );
}
