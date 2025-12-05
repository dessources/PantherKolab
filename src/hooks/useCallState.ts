"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useCalls, type MeetingData } from "@/hooks/useCalls";

interface UseCallStateParams {
  userId: string;
  isAuthenticated: boolean;
}

/**
 * useCallState - Custom hook to manage call state and interactions
 * Separates business logic from UI components
 */
export function useCallState({ userId, isAuthenticated }: UseCallStateParams) {
  const [showMeeting, setShowMeeting] = useState(false);
  const [callType, setCallType] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [recipientId, setRecipientId] = useState(
    "d4e884c8-5011-70f3-e29a-5f29eb210c38"
  );
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);

  // Callbacks for useCalls hook
  const handleCallConnected = useCallback((data: MeetingData) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Call connected! MeetingId:", data.meeting);
    setMeetingData(data);
    setShowMeeting(true);
  }, []);

  const handleCallEnded = useCallback((sessionId: string, endedBy: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log(`Call ${sessionId} ended by ${endedBy}`);
    setShowMeeting(false);
    setMeetingData(null);
    toast.info("Call has ended");
  }, []);

  const handleCallRejected = useCallback((sessionId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Call rejected:", sessionId);
    toast.info("Call was declined");
  }, []);

  const handleCallCancelled = useCallback(
    (sessionId: string, cancelledBy: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
        console.log(`Call ${sessionId} cancelled by ${cancelledBy}`);
    },
    []
  );

  const handleParticipantLeft = useCallback(
    (sessionId: string, userId: string, newOwnerId?: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
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
    toast.error("Call error: " + error);
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
    userId: isAuthenticated ? userId : "",
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallRejected: handleCallRejected,
    onCallCancelled: handleCallCancelled,
    onParticipantLeft: handleParticipantLeft,
    onError: handleError,
  });

  // Handle initiating a call
  const handleInitiateCall = useCallback(async () => {
    if (!recipientId.trim()) {
      toast.warning("Please enter a participant ID");
      return;
    }

    try {
      const participantIds = [userId, recipientId.trim()];
      await initiateCall({
        participantIds,
        callType,
      });
    } catch (error) {
      console.error("Failed to initiate call:", error);
      toast.error(
        "Failed to initiate call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }, [recipientId, userId, callType, initiateCall]);

  // Handle accepting incoming call
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await acceptCall(incomingCall.sessionId);
    } catch (error) {
      console.error("Failed to accept call:", error);
      toast.error(
        "Failed to accept call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }, [incomingCall, acceptCall]);

  // Handle rejecting incoming call
  const handleRejectCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await rejectCall(incomingCall.sessionId, incomingCall.callerId);
    } catch (error) {
      console.error("Failed to reject call:", error);
    }
  }, [incomingCall, rejectCall]);

  // Handle ending the call (only owner can do this)
  const handleEndCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await endCall(activeCall.sessionId);
      setShowMeeting(false);
      setMeetingData(null);
    } catch (error) {
      console.error("Failed to end call:", error);
      toast.error(
        "Failed to end call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }, [activeCall, endCall]);

  // Handle leaving the call (anyone can do this)
  const handleLeaveCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await leaveCall(activeCall.sessionId);
      setShowMeeting(false);
      setMeetingData(null);
    } catch (error) {
      console.error("Failed to leave call:", error);
      toast.error(
        "Failed to leave call: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  }, [activeCall, leaveCall]);

  // Handle cancelling a ringing call
  const handleCancelCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await cancelCall(activeCall.sessionId);
    } catch (error) {
      console.error("Failed to cancel call:", error);
    }
  }, [activeCall, cancelCall]);

  return {
    // State
    showMeeting,
    callType,
    recipientId,
    meetingData,
    isConnected,
    isRinging,
    incomingCall,
    isCallOwner,
    activeCall,

    // State setters
    setCallType,
    setRecipientId,

    // Actions
    handleInitiateCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    handleLeaveCall,
    handleCancelCall,
  };
}
