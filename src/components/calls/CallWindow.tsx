"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { getChimeManager } from "@/lib/chime/ChimeManager";
import type { ChimeManagerConfig } from "@/lib/chime/ChimeManager";

interface CallWindowProps {
  isOpen: boolean;
  callType: "DIRECT" | "GROUP";
  participantName?: string;
  participantCount?: number;
  onMuteToggle?: (isMuted: boolean) => void;
  onCameraToggle?: (isCameraOn: boolean) => void;
  onEndCall: () => Promise<void>;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  remoteVideoRefs?: React.RefObject<HTMLVideoElement>[];
  isLoading?: boolean;
  connectionStatus?: "connecting" | "connected" | "disconnected";
  joinToken?: string;
  chimeConfig?: ChimeManagerConfig;
}

/**
 * Main call window component with video tiles and controls
 * Supports both DIRECT (1-on-1) and GROUP calls
 * Integrates with AWS Chime SDK for media handling
 */
export function CallWindow({
  isOpen,
  callType,
  participantName,
  participantCount = 0,
  onMuteToggle,
  onCameraToggle,
  onEndCall,
  localVideoRef,
  remoteVideoRefs,
  isLoading = false,
  connectionStatus = "connected",
  joinToken,
  chimeConfig,
}: CallWindowProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [chimeInitialized, setChimeInitialized] = useState(false);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const chimeManagerRef = useRef(getChimeManager(chimeConfig));

  // Track call duration
  useEffect(() => {
    if (isOpen && !isEndingCall) {
      durationInterval.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isOpen, isEndingCall]);

  // Initialize and manage Chime session
  useEffect(() => {
    if (!isOpen || !joinToken) return;

    const initializeChime = async () => {
      try {
        const chimeManager = chimeManagerRef.current;

        // Initialize session with join token
        await chimeManager.initializeSession(joinToken);

        // Subscribe to Chime events
        chimeManager.subscribe({
          onParticipantJoined: (attendeeId, externalUserId) => {
            console.log("Participant joined:", externalUserId);
          },
          onParticipantLeft: (attendeeId) => {
            console.log("Participant left:", attendeeId);
          },
          onVideoTileAdded: (tileState) => {
            // Bind remote video element when tile is added
            if (
              !tileState.localTile &&
              remoteVideoRefs &&
              remoteVideoRefs.length > 0
            ) {
              const ref = remoteVideoRefs[remoteVideoRefs.length - 1];
              if (ref?.current) {
                chimeManager.bindVideoElement(
                  tileState.tileId as number,
                  ref.current
                );
              }
            }
          },
          onVideoTileRemoved: (tileState) => {
            // Unbind video element when tile is removed
            chimeManager.unbindVideoElement(tileState.tileId as number);
          },
          onError: (error) => {
            console.error("Chime error:", error);
          },
        });

        // Start meeting
        await chimeManager.start();

        // Start local audio and video
        await chimeManager.startLocalAudio();
        if (isCameraOn) {
          await chimeManager.startLocalVideo();
        }

        setChimeInitialized(true);
      } catch (error) {
        console.error("Failed to initialize Chime:", error);
      }
    };

    initializeChime();

    return () => {
      // Cleanup on component unmount
      chimeManagerRef.current?.cleanup().catch(() => {});
    };
  }, [isOpen, joinToken, isCameraOn, remoteVideoRefs]);

  // Handle mute/unmute
  useEffect(() => {
    if (!chimeInitialized) return;

    const updateAudio = async () => {
      if (isMuted) {
        chimeManagerRef.current.stopLocalAudio().catch(() => {});
      } else {
        chimeManagerRef.current.startLocalAudio().catch(() => {});
      }
    };

    updateAudio();
  }, [isMuted, chimeInitialized]);

  // Handle camera toggle
  useEffect(() => {
    if (!chimeInitialized) return;

    const updateVideo = async () => {
      if (isCameraOn) {
        chimeManagerRef.current.startLocalVideo().catch(() => {});
      } else {
        chimeManagerRef.current.stopLocalVideo().catch(() => {});
      }
    };

    updateVideo();
  }, [isCameraOn, chimeInitialized]);

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    onMuteToggle?.(newMutedState);
  };

  const handleCameraToggle = () => {
    const newCameraState = !isCameraOn;
    setIsCameraOn(newCameraState);
    onCameraToggle?.(newCameraState);
  };

  const handleEndCall = async () => {
    try {
      setIsEndingCall(true);
      await onEndCall();
    } catch (error) {
      console.error("Error ending call:", error);
      setIsEndingCall(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) {
    return null;
  }

  const isDirectCall = callType === "DIRECT";

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span className="text-white text-sm font-['Bitter']">
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>

          {/* Call info */}
          <div>
            <h2 className="text-white font-bold font-['Bitter']">
              {isDirectCall
                ? participantName || "Call"
                : `Group Call (${participantCount})`}
            </h2>
            <p className="text-gray-400 text-sm">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>

        {/* Minimize/Close button */}
        <button
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Minimize"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {isDirectCall ? (
          // DIRECT call layout - local and remote side by side
          <div className="w-full h-full flex gap-2 p-4">
            {/* Remote video - main */}
            <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden">
              {remoteVideoRefs?.[0] ? (
                <video
                  ref={remoteVideoRefs[0]}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center text-4xl font-bold text-gray-500 font-['Bitter'] mx-auto mb-4">
                      {(participantName || "U").charAt(0).toUpperCase()}
                    </div>
                    <p className="text-gray-400">
                      {participantName || "Participant"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Local video - picture in picture */}
            <div className="w-40 h-32 relative bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700">
              {localVideoRef ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-8 h-8 text-gray-600 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                      />
                    </svg>
                    <p className="text-gray-600 text-xs mt-2">You</p>
                  </div>
                </div>
              )}

              {/* Muted indicator on local video */}
              {isMuted && (
                <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.114 5.636l1.414-1.414 1.414 1.414-1.414 1.414 1.414 1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414 1.414 1.414zM4.222 4a2 2 0 00-1.98 2.292l1.005 7.035A6 6 0 0010 17.93V19h4v-2.069a6 6 0 006.753-3.603l1.005-7.035A2 2 0 0019.778 4H4.222z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        ) : (
          // GROUP call layout - grid of video tiles
          <div className="w-full h-full p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Remote participants */}
              {remoteVideoRefs?.map((ref, index) => (
                <div
                  key={index}
                  className="relative bg-gray-800 rounded-lg overflow-hidden"
                >
                  <video
                    ref={ref}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}

              {/* Local video - always visible in group */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500">
                {localVideoRef ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white font-['Bitter']">You</span>
                  </div>
                )}
              </div>

              {/* Placeholder for empty slots */}
              {remoteVideoRefs && remoteVideoRefs.length < 3 && (
                <div className="bg-gray-800 rounded-lg flex items-center justify-center">
                  <p className="text-gray-600 text-sm">
                    Waiting for participants...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4 border-t border-gray-700">
        {/* Mute button */}
        <button
          onClick={handleMuteToggle}
          disabled={isLoading}
          className={`p-3 rounded-full transition-colors ${
            isMuted
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.114 5.636l1.414-1.414 1.414 1.414-1.414 1.414 1.414 1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414-1.414 1.414-1.414-1.414-1.414 1.414-1.414 1.414 1.414z" />
              <path d="M4.222 4a2 2 0 00-1.98 2.292l1.005 7.035A6 6 0 0010 17.93V19h4v-2.069a6 6 0 006.753-3.603l1.005-7.035A2 2 0 0019.778 4H4.222z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 16.91c-1.25.81-2.76 1.29-4.39 1.29-1.63 0-3.14-.48-4.39-1.29l-1.41 1.41c1.78 1.38 4.02 2.21 6.43 2.32v2.94h2v-2.93c2.41-.11 4.65-.94 6.43-2.32l-1.41-1.41z" />
            </svg>
          )}
        </button>

        {/* Camera button */}
        <button
          onClick={handleCameraToggle}
          disabled={isLoading}
          className={`p-3 rounded-full transition-colors ${
            !isCameraOn
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isCameraOn ? "Stop camera" : "Start camera"}
        >
          {isCameraOn ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z" />
              <line
                x1="2"
                y1="2"
                x2="22"
                y2="22"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {/* End call button */}
        <button
          onClick={handleEndCall}
          disabled={isEndingCall || isLoading}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="End call"
        >
          {isEndingCall ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
