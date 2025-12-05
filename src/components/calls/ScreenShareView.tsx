"use client";

import { useEffect, useRef } from "react";

interface VideoTileInfo {
  tileId: number;
  attendeeId: string;
  isLocalTile: boolean;
  isContent: boolean;
}

interface ScreenShareViewProps {
  contentTile: VideoTileInfo;
  onVideoElementReady: (tileId: number, element: HTMLVideoElement) => void;
}

export function ScreenShareView({
  contentTile,
  onVideoElementReady,
}: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && contentTile.tileId) {
      onVideoElementReady(contentTile.tileId, videoRef.current);
    }
  }, [contentTile.tileId, onVideoElementReady]);

  return (
    <div className="h-[80%] bg-black flex items-center justify-center px-4 md:px-8 lg:px-16 xl:px-24 py-4">
      <div className="w-full h-full max-w-7xl">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-gray-900 rounded-lg"
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
}
