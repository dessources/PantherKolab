"use client";

import { useAuth } from "@/components/contexts/AuthContext";
import { MeetingView } from "@/components/calls/MeetingView";
import { IncomingCallModal } from "@/components/calls/IncomingCallModal";
import { CallControlPanel } from "@/components/calls/CallControlPanel";
import { useCallState } from "@/hooks/useCallState";
import { toast } from "sonner";

/**
 * Call Page - Production call interface with AppSync Events integration
 * Combines the UI from MeetingViewDev with real call functionality
 */
export default function CallPage() {
  const auth = useAuth();
  const localUserId = auth.user?.userId || "";
  const isAuthenticated = auth.isAuthenticated;

  // Use custom hook for call state management
  const {
    showMeeting,
    callType,
    recipientId,
    meetingData,
    isConnected,
    isRinging,
    incomingCall,
    isCallOwner,
    activeCall,
    activeWhiteboard,
    setCallType,
    setRecipientId,
    handleInitiateCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    handleLeaveCall,
    handleCancelCall,
    handleOpenWhiteboard,
    handleCloseWhiteboard,
  } = useCallState({ userId: localUserId, isAuthenticated });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Landing Page - Show when not in a call */}
      {!showMeeting && (
        <div className="p-8 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            PantherKolab Video Calls
          </h1>
          <p className="text-gray-600 mb-8">
            Connect with FIU students for study sessions, project collaboration,
            and more.
          </p>

          {/* Call Control Panel */}
          <CallControlPanel
            isConnected={isConnected}
            isRinging={isRinging}
            localUserId={localUserId}
            callType={callType}
            recipientId={recipientId}
            onCallTypeChange={setCallType}
            onRecipientIdChange={setRecipientId}
            onInitiateCall={handleInitiateCall}
            onCancelCall={handleCancelCall}
          />

          {/* Features List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">
              Features
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>AWS Chime SDK:</strong> Professional-grade video and
                  audio quality
                </span>
              </li>
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
                  <strong>Responsive Layout:</strong> Optimized grid layout for
                  any number of participants
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Meeting Controls:</strong> Audio, video toggle, and
                  end call controls
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>
                  <strong>Incoming Calls:</strong> Beautiful modal with caller
                  info and accept/decline options
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callType={incomingCall.callType === "AUDIO" ? "DIRECT" : "DIRECT"}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Meeting View - Show during active call */}
      {showMeeting && meetingData && (
        <MeetingView
          meetingTitle="PantherKolab Video Call"
          meetingSubtitle="Florida International University"
          isCallOwner={isCallOwner}
          meeting={meetingData.meeting}
          attendee={
            localUserId ? meetingData.attendees?.[localUserId] : undefined
          }
          localUserId={localUserId}
          participantNames={{}} // Empty map for standalone calls - will display userIds
          conversationId={activeCall?.conversationId || ""}
          activeWhiteboard={activeWhiteboard}
          onEndCall={handleEndCall}
          onLeaveCall={handleLeaveCall}
          onOpenWhiteboard={handleOpenWhiteboard}
          onCloseWhiteboard={handleCloseWhiteboard}
          onSettingsClick={() => toast.info("Settings clicked")}
        />
      )}
    </div>
  );
}
