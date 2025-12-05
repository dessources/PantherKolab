/**
 * useCalls Hook
 *
 * Manages call state and real-time call events using AppSync Events.
 * Uses user-centric subscriptions (/users/{userId}) for incoming calls.
 *
 * Features:
 * - Incoming call notifications
 * - Call state management (ringing, connected, ended)
 * - Call ownership tracking for group calls
 * - Client-side owner validation for end call
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { subscribeToUserNotifications } from "@/lib/appSync/appsync-client";
import type {
  IncomingCallEvent,
  CallConnectedEvent,
  CallRejectedEvent,
  CallEndedEvent,
  CallCancelledEvent,
  ParticipantLeftEvent,
  ParticipantJoinedEvent,
  CallErrorEvent,
  CallEvent,
} from "@/types/appsync-events";
import type { CallType } from "@/types/database";
import { soundEffects } from "@/lib/sounds/soundEffects";

// ============================================================================
// Types
// ============================================================================

export interface IncomingCall {
  sessionId: string;
  callerId: string;
  callerName: string;
  callType: "AUDIO" | "VIDEO";
}

export interface MeetingData {
  sessionId: string;
  meeting: CallConnectedEvent["data"]["meeting"];
  attendees: CallConnectedEvent["data"]["attendees"];
}

export interface ActiveCall {
  sessionId: string;
  callType: CallType;
  isOwner: boolean; // Whether current user is the call owner
  meeting?: MeetingData["meeting"];
  attendees?: MeetingData["attendees"];
}

export interface UseCallsOptions {
  userId: string;
  onIncomingCall?: (call: IncomingCall) => void;
  onCallConnected?: (data: MeetingData) => void;
  onCallEnded?: (sessionId: string, endedBy: string) => void;
  onCallRejected?: (sessionId: string) => void;
  onCallCancelled?: (sessionId: string, cancelledBy: string) => void;
  onParticipantLeft?: (
    sessionId: string,
    userId: string,
    newOwnerId?: string
  ) => void;
  onParticipantJoined?: (
    sessionId: string,
    userId: string,
    attendee: ParticipantJoinedEvent["data"]["attendee"]
  ) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useCalls({
  userId,
  onIncomingCall,
  onCallConnected,
  onCallEnded,
  onCallRejected,
  onCallCancelled,
  onParticipantLeft,
  onParticipantJoined,
  onError,
}: UseCallsOptions) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Call state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  // Track if current user initiated the call (for ownership)
  const isCallInitiatorRef = useRef(false);

  // Subscription ref for cleanup
  const subscriptionRef = useRef<{ close: () => void } | null>(null);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCallEvent = useCallback(
    (event: CallEvent) => {
      switch (event.type) {
        case "INCOMING_CALL": {
          const data = event.data as IncomingCallEvent["data"];
          const incoming: IncomingCall = {
            sessionId: data.sessionId,
            callerId: data.callerId,
            callerName: data.callerName,
            callType: data.callType,
          };
          setIncomingCall(incoming);
          soundEffects.play("call-ringing");
          onIncomingCall?.(incoming);
          break;
        }

        case "CALL_RINGING": {
          setIsRinging(true);
          soundEffects.play("call-ringing");
          break;
        }

        case "CALL_CONNECTED": {
          const data = event.data as CallConnectedEvent["data"];
          setActiveCall({
            sessionId: data.sessionId,
            callType: "DIRECT", // Will be updated if group call
            isOwner: isCallInitiatorRef.current, // Initiator is initial owner
            meeting: data.meeting,
            attendees: data.attendees,
          });
          setIsRinging(false);
          setIncomingCall(null);
          soundEffects.stopRinging();

          const meetingData: MeetingData = {
            sessionId: data.sessionId,
            meeting: data.meeting,
            attendees: data.attendees,
          };
          onCallConnected?.(meetingData);
          break;
        }

        case "PARTICIPANT_JOINED": {
          const data = event.data as ParticipantJoinedEvent["data"];
          setActiveCall((prev) => {
            if (!prev || prev.sessionId !== data.sessionId) return prev;
            return {
              ...prev,
              attendees: {
                ...prev.attendees,
                [data.userId]: data.attendee,
              },
            };
          });
          onParticipantJoined?.(data.sessionId, data.userId, data.attendee);
          break;
        }

        case "CALL_REJECTED": {
          const data = event.data as CallRejectedEvent["data"];
          setIsRinging(false);
          isCallInitiatorRef.current = false;
          soundEffects.stopRinging();
          onCallRejected?.(data.sessionId);
          break;
        }

        case "CALL_ENDED": {
          const data = event.data as CallEndedEvent["data"];
          setActiveCall(null);
          setIsRinging(false);
          setIncomingCall(null);
          isCallInitiatorRef.current = false;
          soundEffects.play("call-ended");
          onCallEnded?.(data.sessionId, data.endedBy);
          break;
        }

        case "CALL_CANCELLED": {
          // Caller cancelled the call before recipient accepted
          const data = event.data as CallCancelledEvent["data"];
          setIncomingCall(null); // Dismiss the incoming call notification
          soundEffects.stopRinging();
          onCallCancelled?.(data.sessionId, data.cancelledBy);
          break;
        }

        case "PARTICIPANT_LEFT": {
          const data = event.data as ParticipantLeftEvent["data"] & {
            newOwnerId?: string;
          };

          // If ownership was transferred to current user, update our state
          if (data.newOwnerId === userId) {
            setActiveCall((prev) => (prev ? { ...prev, isOwner: true } : prev));
          }

          onParticipantLeft?.(data.sessionId, data.userId, data.newOwnerId);
          break;
        }

        case "CALL_ERROR": {
          const data = event.data as CallErrorEvent["data"];
          setError(new Error(data.error));
          onError?.(data.error);
          break;
        }
      }
    },
    [
      userId,
      onIncomingCall,
      onCallConnected,
      onCallEnded,
      onCallRejected,
      onCallCancelled,
      onParticipantLeft,
      onParticipantJoined,
      onError,
    ]
  );

  // ============================================================================
  // Subscription Effect
  // ============================================================================

  useEffect(() => {
    if (!userId) return;

    const subscribe = async () => {
      try {
        // USER-CENTRIC: Subscribe to user's notification channel
        // Receives all call-related events (incoming, connected, ended, etc.)
        subscriptionRef.current = await subscribeToUserNotifications(
          userId,
          (event) => {
            // Filter for call events only
            const callEventTypes: CallEvent["type"][] = [
              "INCOMING_CALL",
              "CALL_RINGING",
              "CALL_CONNECTED",
              "CALL_REJECTED",
              "CALL_ENDED",
              "CALL_CANCELLED",
              "PARTICIPANT_LEFT",
              "PARTICIPANT_JOINED",
              "CALL_ERROR",
            ];

            if (callEventTypes.includes(event.type as CallEvent["type"])) {
              handleCallEvent(event as CallEvent);
            }
          },
          (err) => {
            setError(err);
            onError?.(err.message);
          }
        );

        setIsConnected(true);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        process.env.NODE_ENV !== "production" && console.log("[useCalls] Connected to user notifications");
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to connect");
        setError(error);
        onError?.(error.message);
      }
    };

    subscribe();

    return () => {
      subscriptionRef.current?.close();
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" && console.log("[useCalls] Disconnected from user notifications");
    };
  }, [userId, handleCallEvent, onError]);

  // ============================================================================
  // API Methods
  // ============================================================================

  /**
   * Initiate a new call
   */
  const initiateCall = useCallback(
    async (params: {
      participantIds: string[];
      callType: CallType;
      conversationId?: string;
    }): Promise<void> => {
      try {
        setIsRinging(true);
        isCallInitiatorRef.current = true;

        const response = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callType: params.callType,
            initiatedBy: userId,
            participantIds: params.participantIds,
            conversationId: params.conversationId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to initiate call");
        }

        // The CALL_CONNECTED event will be received via subscription
        // which triggers the onCallConnected callback.
      } catch (err) {
        setIsRinging(false);
        isCallInitiatorRef.current = false;
        throw err;
      }
    },
    [userId]
  );

  /**
   * Accept an incoming call
   */
  const acceptCall = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch("/api/calls/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to accept call");
      }

      // The CALL_CONNECTED event will be received via subscription
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Reject an incoming call
   */
  const rejectCall = useCallback(
    async (sessionId: string, callerId: string): Promise<void> => {
      try {
        const response = await fetch("/api/calls/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, callerId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to reject call");
        }

        setIncomingCall(null);
      } catch (err) {
        console.error("[useCalls] Error rejecting call:", err);
        throw err;
      }
    },
    []
  );

  /**
   * Cancel a ringing call (caller only)
   */
  const cancelCall = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch("/api/calls/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel call");
      }

      setIsRinging(false);
      isCallInitiatorRef.current = false;
    } catch (err) {
      console.error("[useCalls] Error cancelling call:", err);
      throw err;
    }
  }, []);

  /**
   * Leave a call without ending it for others
   * For group calls, if you're the owner, you must specify a new owner
   */
  const leaveCall = useCallback(
    async (sessionId: string, newOwnerId?: string): Promise<void> => {
      try {
        // Client-side validation for group call owners
        if (
          activeCall?.isOwner &&
          activeCall.callType === "GROUP" &&
          !newOwnerId
        ) {
          throw new Error(
            "Call owner must specify a new owner before leaving a group call"
          );
        }

        const response = await fetch("/api/calls/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, newOwnerId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to leave call");
        }

        setActiveCall(null);
        isCallInitiatorRef.current = false;
      } catch (err) {
        console.error("[useCalls] Error leaving call:", err);
        throw err;
      }
    },
    [activeCall]
  );

  /**
   * End a call (terminates for everyone)
   * Only the call owner can end the call
   */
  const endCall = useCallback(
    async (sessionId: string): Promise<void> => {
      // Client-side owner check (backend will also verify)
      if (activeCall && !activeCall.isOwner) {
        const error = "Only the call owner can end the call";
        onError?.(error);
        throw new Error(error);
      }

      try {
        const response = await fetch("/api/calls/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to end call");
        }

        setActiveCall(null);
        isCallInitiatorRef.current = false;
      } catch (err) {
        console.error("[useCalls] Error ending call:", err);
        throw err;
      }
    },
    [activeCall, onError]
  );

  /**
   * Dismiss incoming call notification without rejecting
   * (e.g., if call was cancelled by caller)
   */
  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Connection state
    isConnected,
    error,

    // Call state
    activeCall,
    isRinging,
    incomingCall,

    // Computed state
    isInCall: activeCall !== null,
    isCallOwner: activeCall?.isOwner ?? false,

    // Actions
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    leaveCall,
    endCall,
    dismissIncomingCall,
  };
}