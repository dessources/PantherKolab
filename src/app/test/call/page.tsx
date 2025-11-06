"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/contexts/AuthContext";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  getChimeManager,
  ChimeManagerConfig,
  ChimeObserver,
} from "@/lib/chime/ChimeManager";
import { LogLevel } from "amazon-chime-sdk-js";

/**
 * Call Test Page
 * Allows testing of the complete video call flow with UI controls
 * Navigate to /test/call to use this
 */

type CallStep =
  | "idle"
  | "initiating"
  | "ringing"
  | "connecting"
  | "connected"
  | "error";

type ChimeManagerType = ReturnType<typeof getChimeManager>;

export default function CallTestPage() {
  const { user } = useAuth();
  const [callStep, setCallStep] = useState<CallStep>("idle");
  const [recipientId, setRecipientId] = useState("user2");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [chimeManager, setChimeManager] = useState<ChimeManagerType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [remoteParticipants, setRemoteParticipants] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Helper function to add logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Initialize Chime Manager on mount
  useEffect(() => {
    const config: ChimeManagerConfig = {
      enableLogging: true,
      loggingLevel: LogLevel.INFO,
    };
    const manager = getChimeManager(config);
    setChimeManager(manager);
    addLog("ChimeManager initialized");

    return () => {
      // Cleanup on unmount
      manager.cleanup().catch((err) => addLog(`Cleanup error: ${err.message}`));
    };
  }, []);

  /**
   * Step 1: Initiate a call
   */
  const handleInitiateCall = async () => {
    try {
      if (!user?.userId) {
        throw new Error("User not authenticated");
      }

      setCallStep("initiating");
      setError(null);
      addLog("Initiating call...");

      // Get ID token from Cognito session (required for API authentication)
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        throw new Error("No ID token found");
      }

      // Call API to initiate call
      const response = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          callType: "DIRECT",
          participantIds: [recipientId],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API error: ${errData.message || response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Call initiation failed: ${data.message}`);
      }

      setSessionId(data.data.sessionId);
      setTimestamp(data.data.timestamp);
      setCallStep("ringing");
      addLog(`Call initiated. Session: ${data.data.sessionId}`);

      // In real scenario, Socket.IO would notify recipient
      addLog("⏳ Waiting for recipient to answer...");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setCallStep("error");
      addLog(`❌ Error: ${message}`);
    }
  };

  /**
   * Step 2: Accept a call (simulate recipient accepting)
   */
  const handleAcceptCall = async () => {
    try {
      if (!sessionId || !timestamp) {
        throw new Error("No active call to accept");
      }

      setCallStep("connecting");
      setError(null);
      addLog("Accepting call...");

      // Get ID token from Cognito session (required for API authentication)
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        throw new Error("No ID token found");
      }

      // Update participant status to JOINED
      const updateResponse = await fetch(
        `/api/calls/${sessionId}/participant-update?timestamp=${encodeURIComponent(
          timestamp
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: "JOINED",
          }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Failed to update participant status`);
      }

      addLog("Call accepted");

      // Get join info
      addLog("Fetching call credentials...");
      const joinInfoResponse = await fetch("/api/calls/join-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          timestamp,
        }),
      });

      if (!joinInfoResponse.ok) {
        throw new Error("Failed to get join info");
      }

      const joinInfoData = await joinInfoResponse.json();
      if (!joinInfoData.success) {
        throw new Error(`Get join info failed: ${joinInfoData.message}`);
      }

      setJoinToken(joinInfoData.data.joinToken);
      setAttendeeId(joinInfoData.data.attendeeId);
      addLog(`Got join token: ${joinInfoData.data.attendeeId}`);

      // Initialize Chime
      if (chimeManager) {
        addLog("Initializing Chime session...");
        await chimeManager.initializeSession(joinInfoData.data.joinToken);
        addLog("Chime session initialized");

        // Subscribe to Chime events
        const observer: ChimeObserver = {
          onParticipantJoined: (attendeeId, userId) => {
            addLog(`👤 Participant joined: ${userId}`);
            setRemoteParticipants((prev) => [...new Set([...prev, userId])]);
          },
          onParticipantLeft: (attendeeId) => {
            addLog(`👤 Participant left: ${attendeeId}`);
          },
          onVideoTileAdded: (tileState) => {
            if (tileState.tileId !== null) {
              addLog(`📹 Video tile added: ${tileState.tileId}`);
              if (!tileState.localTile && remoteVideoRef.current) {
                chimeManager.bindVideoElement(
                  tileState.tileId,
                  remoteVideoRef.current
                );
                addLog("Remote video bound");
              }
            }
          },
          onVideoTileRemoved: (tileState) => {
            addLog(`📹 Video tile removed: ${tileState.tileId}`);
          },
          onError: (err) => {
            addLog(`❌ Chime error: ${err.message}`);
            setError(err.message);
          },
        };
        chimeManager.subscribe(observer);

        // Start the meeting
        addLog("Starting meeting...");
        await chimeManager.start();
        addLog("✅ Meeting started");

        // Start local audio/video
        await chimeManager.startLocalAudio();
        addLog("🎤 Local audio started");

        if (isCameraOn) {
          await chimeManager.startLocalVideo();
          addLog("📷 Local video started");
        }

        setCallStep("connected");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setCallStep("error");
      addLog(`❌ Error: ${message}`);
    }
  };

  /**
   * Toggle local audio
   */
  const handleToggleMute = async () => {
    try {
      if (!chimeManager) return;

      if (isMuted) {
        await chimeManager.startLocalAudio();
        setIsMuted(false);
        addLog("🔊 Unmuted");
      } else {
        await chimeManager.stopLocalAudio();
        setIsMuted(true);
        addLog("🔇 Muted");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Toggle mute error: ${message}`);
    }
  };

  /**
   * Toggle local video
   */
  const handleToggleCamera = async () => {
    try {
      if (!chimeManager) return;

      if (isCameraOn) {
        await chimeManager.stopLocalVideo();
        setIsCameraOn(false);
        addLog("📷 Camera off");
      } else {
        await chimeManager.startLocalVideo();
        setIsCameraOn(true);
        addLog("📷 Camera on");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Toggle camera error: ${message}`);
    }
  };

  /**
   * End the call
   */
  const handleEndCall = async () => {
    try {
      setCallStep("idle");
      addLog("Ending call...");

      if (chimeManager) {
        await chimeManager.cleanup();
        addLog("Chime cleanup completed");
      }

      if (sessionId && timestamp) {
        // Get ID token from Cognito session (required for API authentication)
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) {
          await fetch(
            `/api/calls/${sessionId}/end?timestamp=${encodeURIComponent(
              timestamp
            )}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                endReason: "COMPLETED",
              }),
            }
          );
          addLog("Call ended via API");
        }
      }

      setSessionId(null);
      setTimestamp(null);
      setJoinToken(null);
      setAttendeeId(null);
      setRemoteParticipants([]);
      setError(null);
      addLog("✅ Call ended");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ End call error: ${message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📞 Call Test Page</h1>
          <p className="text-gray-400">
            Test the video call feature. Current user:{" "}
            <span className="text-blue-400">
              {user?.userId || "Not logged in"}
            </span>
          </p>
          {!user?.userId && (
            <div className="bg-red-900 border border-red-700 rounded p-4 mt-4">
              ⚠️ Please log in before testing calls
            </div>
          )}
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Video Area */}
          <div className="col-span-2">
            <div className="space-y-4">
              {/* Local Video */}
              <div className="bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <div className="w-full h-full bg-black flex items-center justify-center relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded text-sm">
                    📹 Local Video
                  </div>
                </div>
              </div>

              {/* Remote Video */}
              <div className="bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <div className="w-full h-full bg-black flex items-center justify-center relative">
                  {remoteParticipants.length > 0 ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 text-center">
                      <p className="text-xl mb-2">👤 Remote Video</p>
                      <p className="text-sm">
                        Waiting for remote participant...
                      </p>
                    </div>
                  )}
                  {remoteParticipants.length > 0 && (
                    <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded text-sm">
                      📹 Remote: {remoteParticipants[0]}
                    </div>
                  )}
                </div>
              </div>

              {/* Call Status */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">Call Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Status</p>
                    <p className="text-xl font-mono">
                      <span
                        className={
                          callStep === "connected"
                            ? "text-green-400"
                            : callStep === "error"
                            ? "text-red-400"
                            : callStep === "ringing"
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }
                      >
                        {callStep.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Session ID</p>
                    <p className="text-xs font-mono text-blue-400 truncate">
                      {sessionId || "None"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="space-y-6">
            {/* Setup Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Setup</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Recipient ID
                  </label>
                  <input
                    type="text"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    disabled={callStep !== "idle"}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
                    placeholder="user2"
                  />
                </div>
              </div>
            </div>

            {/* Actions Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              <div className="space-y-3">
                {callStep === "idle" && (
                  <button
                    onClick={handleInitiateCall}
                    disabled={!user?.userId}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold transition"
                  >
                    📞 Initiate Call
                  </button>
                )}

                {callStep === "ringing" && (
                  <>
                    <button
                      onClick={handleAcceptCall}
                      className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold transition"
                    >
                      ✅ Accept Call
                    </button>
                    <button
                      onClick={handleEndCall}
                      className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold transition"
                    >
                      ❌ Decline Call
                    </button>
                  </>
                )}

                {callStep === "connecting" && (
                  <button
                    disabled
                    className="w-full bg-blue-600 px-4 py-2 rounded font-semibold"
                  >
                    ⏳ Connecting...
                  </button>
                )}

                {callStep === "connected" && (
                  <>
                    <button
                      onClick={handleToggleMute}
                      className={`w-full px-4 py-2 rounded font-semibold transition ${
                        isMuted
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {isMuted ? "🔇 Unmute" : "🎤 Mute"}
                    </button>
                    <button
                      onClick={handleToggleCamera}
                      className={`w-full px-4 py-2 rounded font-semibold transition ${
                        !isCameraOn
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {!isCameraOn ? "🚫 Camera Off" : "📷 Camera On"}
                    </button>
                    <button
                      onClick={handleEndCall}
                      className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold transition"
                    >
                      📵 End Call
                    </button>
                  </>
                )}

                {callStep === "error" && (
                  <button
                    onClick={() => {
                      setCallStep("idle");
                      setError(null);
                    }}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded font-semibold transition"
                  >
                    🔄 Reset
                  </button>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900 border border-red-700 rounded p-4">
                <p className="text-sm font-semibold mb-2">❌ Error</p>
                <p className="text-xs text-red-200">{error}</p>
              </div>
            )}

            {/* Info Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Info</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <p>
                  <span className="text-gray-300">Attendee ID:</span>{" "}
                  {attendeeId ? (
                    <span className="text-blue-400 font-mono">
                      {attendeeId}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <span className="text-gray-300">Participants:</span>{" "}
                  {remoteParticipants.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Section */}
        <div className="mt-8 bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">📋 Event Log</h3>
          <div className="bg-gray-900 rounded p-3 h-48 overflow-y-auto font-mono text-xs text-gray-300 space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-gray-400">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">📚 How to Test</h3>
          <ol className="space-y-2 text-sm text-blue-100 list-decimal list-inside">
            <li>
              Open this page in two different browsers or tabs (logged in as
              different users)
            </li>
            <li>In Browser 1, click Initiate Call to call the recipient</li>
            <li>In Browser 2, click Accept Call to join the call</li>
            <li>Use the mute/camera buttons to test controls</li>
            <li>Click End Call to terminate</li>
            <li>Check the event log to see all API calls and Chime events</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
