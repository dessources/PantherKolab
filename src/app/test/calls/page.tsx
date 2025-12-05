"use client";

import { useState, useCallback } from "react";
import { MeetingView } from "@/components/calls/MeetingView";
import { IncomingCallModal } from "@/components/calls/IncomingCallModal";
import { OutgoingCallModal } from "@/components/calls/OutgoingCallModal";
import { useCalls, type MeetingData } from "@/hooks/useCalls";
import { useAuth } from "@/components/contexts/AuthContext";

export default function MeetingUITestPage() {
  const [showMeeting, setShowMeeting] = useState(false);
  const [callType, setCallType] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [participants, setParticipants] = useState(
    "d4e884c8-5011-70f3-e29a-5f29eb210c38"
  );
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [showOutgoingCall, setShowOutgoingCall] = useState(false);
  const [outgoingRecipientName, setOutgoingRecipientName] = useState("");

  const auth = useAuth();
  const localUserId = auth.user?.userId || "";
  const isAuthenticated = auth.isAuthenticated;

  // Callbacks for useCalls hook
  const handleCallConnected = useCallback((data: MeetingData) => {
    console.log("Call connected! MeetingId:", data.meeting);
    setMeetingData(data);
    setShowOutgoingCall(false); // Close outgoing modal
    setShowMeeting(true);
  }, []);

  const handleCallEnded = useCallback((sessionId: string, endedBy: string) => {
    console.log(`Call ${sessionId} ended by ${endedBy}`);
    setShowMeeting(false);
    setMeetingData(null);
    setShowOutgoingCall(false); // Close outgoing modal
    alert("Call has ended");
  }, []);

  const handleCallRejected = useCallback((sessionId: string) => {
    console.log("Call rejected:", sessionId);
    setShowOutgoingCall(false); // Close outgoing modal
    alert("Call was declined");
  }, []);

  const handleCallCancelled = useCallback(
    (sessionId: string, cancelledBy: string) => {
      console.log(`Call ${sessionId} cancelled by ${cancelledBy}`);
      setShowOutgoingCall(false); // Close outgoing modal
    },
    []
  );

  const handleParticipantLeft = useCallback(
    (sessionId: string, userId: string, newOwnerId?: string) => {
      console.log(
        `Participant ${userId} left call ${sessionId}${
          newOwnerId ? `, new owner: ${newOwnerId}` : ""
        }`
      );
    },
    []
  );

  const handleError = useCallback((error: string) => {
    console.error("Call error:", error);
    setShowOutgoingCall(false); // Close outgoing modal on error
    alert("Call error: " + error);
  }, []);

  // Use the useCalls hook - only connect when fully authenticated
  const {
    isConnected,
    activeCall,
    isRinging,
    incomingCall,
    isCallOwner,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    leaveCall,
    endCall,
  } = useCalls({
    userId: isAuthenticated ? localUserId : "",
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallRejected: handleCallRejected,
    onCallCancelled: handleCallCancelled,
    onParticipantLeft: handleParticipantLeft,
    onError: handleError,
  });

  // Mock participants for UI testing
  const mockParticipants = [
    {
      id: "1",
      name: "Uma Swamy",
      isLocal: false,
      isMuted: false,
      hasVideo: true,
    },
    {
      id: "2",
      name: "Dr. Maria Rodriguez",
      isLocal: false,
      isMuted: false,
      hasVideo: true,
    },
    {
      id: "3",
      name: "George Washington",
      isLocal: false,
      isMuted: true,
      hasVideo: true,
    },
    {
      id: "4",
      name: "Michael Johnson",
      isLocal: false,
      isMuted: false,
      hasVideo: true,
    },
    { id: "5", name: "You", isLocal: true, isMuted: false, hasVideo: true },
    {
      id: "6",
      name: "Abraham Lincoln",
      isLocal: false,
      isMuted: false,
      hasVideo: false,
    },
  ].slice(0, 6);

  // Handle initiating a call
  const handleInitiateCall = async () => {
    const recipientId = participants.trim();
    if (!recipientId) {
      alert("Please enter a participant ID");
      return;
    }

    // For now, use the ID as the name. In a real app, you'd fetch this.
    setOutgoingRecipientName(recipientId);
    setShowOutgoingCall(true);

    try {
      const participantIds = [localUserId, recipientId];
      await initiateCall({
        participantIds,
        callType,
      });
    } catch (error) {
      console.error("Failed to initiate call:", error);
      setShowOutgoingCall(false);
      alert(
        "Failed to initiate call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Handle accepting incoming call
  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    try {
      await acceptCall(incomingCall.sessionId);
    } catch (error) {
      console.error("Failed to accept call:", error);
      alert(
        "Failed to accept call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Handle rejecting incoming call
  const handleRejectCall = async () => {
    if (!incomingCall) return;

    try {
      await rejectCall(incomingCall.sessionId, incomingCall.callerId);
    } catch (error) {
      console.error("Failed to reject call:", error);
    }
  };

  // Handle ending the call (only owner can do this)
  const handleEndCall = async () => {
    if (!activeCall) return;

    try {
      await endCall(activeCall.sessionId);
      setShowMeeting(false);
      setMeetingData(null);
    } catch (error) {
      console.error("Failed to end call:", error);
      alert(
        "Failed to end call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Handle leaving the call (anyone can do this)
  const handleLeaveCall = async () => {
    if (!activeCall) return;

    try {
      await leaveCall(activeCall.sessionId);
      setShowMeeting(false);
      setMeetingData(null);
    } catch (error) {
      console.error("Failed to leave call:", error);
      alert(
        "Failed to leave call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Handle cancelling a ringing call from the modal
  const handleCancelFromModal = async () => {
    if (!activeCall) return;
    try {
      await cancelCall(activeCall.sessionId);
      setShowOutgoingCall(false);
    } catch (error) {
      console.error("Failed to cancel call:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!showMeeting ? (
        <div className="p-8 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PantherKolab Meeting UI
          </h1>
          <p className="text-gray-600 mb-8">
            Professional video call interface using AppSync Events
          </p>

          {/* Connection Status */}
          <div className="mb-6 flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? "Connected to AppSync" : "Disconnected"}
            </span>
          </div>

          {/* Test Controls */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">
              Component Testing
            </h2>

            <div className="space-y-6">
              {/* Meeting View Test */}
              <div>
                <h3 className="font-semibold text-lg mb-4 text-gray-800">
                  {`Call Test - User ID: ${
                    auth.user?.userId || "Not logged in"
                  }`}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter a user ID to call. Uses AppSync Events for real-time
                  signaling.
                </p>
                <div className="flex gap-4 items-center flex-wrap">
                  <select
                    value={callType}
                    onChange={(e) =>
                      setCallType(e.target.value as "DIRECT" | "GROUP")
                    }
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                  >
                    <option value="DIRECT">Direct Call</option>
                    <option value="GROUP">Group Call</option>
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      Recipient ID:
                    </label>
                    <input
                      type="text"
                      value={participants}
                      onChange={(e) => setParticipants(e.target.value)}
                      placeholder="Enter user ID"
                      className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
                    />
                  </div>
                  
                    <button
                      onClick={handleInitiateCall}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      disabled={!isConnected || !localUserId || showOutgoingCall}
                    >
                      Start Call
                    </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">
              Features
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>AppSync Events:</strong> Real-time call signaling via
                  AWS AppSync Events API
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Call Ownership:</strong> Only call owners can end
                  calls; ownership transfer for group calls
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Participant Tiles:</strong> Responsive grid layout
                  with AWS Chime SDK integration
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Meeting Controls:</strong> Audio, video, screen share,
                  participants, chat, and end call buttons
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Incoming Call:</strong> Beautiful modal with caller
                  info and accept/decline options
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Call Cancellation:</strong> Caller can cancel before
                  recipient answers
                </span>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callType={incomingCall.callType === "AUDIO" ? "DIRECT" : "DIRECT"}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Outgoing Call Modal */}
      {showOutgoingCall && (
        <OutgoingCallModal
          recipientName={outgoingRecipientName}
          callType="DIRECT" // Assuming direct for now
          status={isRinging ? 'ringing' : 'initiating'}
          onCancel={handleCancelFromModal}
        />
      )}

      {/* Meeting View */}
      {showMeeting && meetingData && (
        <MeetingView
          meetingTitle="PantherKolab Video Call"
          meetingSubtitle="Florida International University"
          participants={mockParticipants}
          activeSpeakerId="2"
          isCallOwner={isCallOwner}
          meeting={meetingData.meeting}
          attendee={
            localUserId ? meetingData.attendees?.[localUserId] : undefined
          }
          localUserId={localUserId}
          onEndCall={handleEndCall}
          onLeaveCall={handleLeaveCall}
          onSettingsClick={() => alert("Settings clicked")}
        />
      )}
    </div>
  );
}