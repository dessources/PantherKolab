"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ParticipantTile } from "./ParticipantTile";

interface VideoTileInfo {
  tileId: number;
  attendeeId: string;
  isLocalTile: boolean;
  isContent: boolean;
}

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  tileId: number;
}

interface ParticipantStripProps {
  participants: Participant[];
  activeSpeakerId?: string | null;
  onVideoElementReady: (tileId: number, element: HTMLVideoElement) => void;
}

export function ParticipantStrip({
  participants,
  activeSpeakerId,
  onVideoElementReady,
}: ParticipantStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300; // pixels to scroll
    const newScrollLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  // Check scroll on mount and when participants change
  useEffect(() => {
    checkScroll();
  }, [participants]);

  return (
    <div className="h-[20%] bg-gray-900 relative flex items-center px-4 md:px-8 lg:px-16 xl:px-24 py-3">
      {/* Left scroll button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 z-10 p-2 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Scrollable participant tiles */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto scrollbar-hide h-full items-center py-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex-shrink-0 w-64 h-32 rounded-lg overflow-hidden"
          >
            <ParticipantTile
              name={participant.name}
              isScreenShareActive={true}
              isLocal={participant.isLocal}
              isActiveSpeaker={activeSpeakerId === participant.id}
              isMuted={participant.isMuted}
              hasVideo={participant.hasVideo}
              tileId={participant.tileId}
              onVideoElementReady={onVideoElementReady}
            />
          </div>
        ))}
      </div>

      {/* Right scroll button */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 z-10 p-2 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}
