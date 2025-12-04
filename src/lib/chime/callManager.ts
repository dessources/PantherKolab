import {
  Attendee,
  ChimeSDKMeetings,
  Meeting,
} from "@aws-sdk/client-chime-sdk-meetings";
import { callService } from "@/services/callService";
import type { CallType, Call } from "@/types/database";

// Initialize AWS Chime SDK Meetings client

const chime = new ChimeSDKMeetings({
  region: process.env.AWS_CHIME_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate a unique client ID for tracking attendees
 */
function generateClientId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export const callManager = {
  /**
   * Initiate a new call (creates call record in RINGING state)
   * Called when caller initiates the call
   */
  async initiateCall(data: {
    callType: CallType;
    initiatedBy: string;
    participantIds: string[];
    conversationId?: string;
  }): Promise<{ call: Call; meeting: Meeting; attendee: Attendee }> {
    // Validate input
    if (!data.callType || !data.initiatedBy || !data.participantIds?.length) {
      throw new Error(
        "Missing required fields: callType, initiatedBy, participantIds"
      );
    }

    // Create call record in database
    const call = await callService.createCall({
      callType: data.callType,
      initiatedBy: data.initiatedBy,
      participantIds: data.participantIds,
      conversationId: data.conversationId,
    });

    // Create Chime meeting
    const meeting = await chime.createMeeting({
      ClientRequestToken: call.sessionId,
      MediaRegion: process.env.AWS_CHIME_REGION || "us-east-1",
      ExternalMeetingId: call.sessionId,
    });

    if (!meeting.Meeting?.MeetingId) {
      throw new Error("Failed to create Chime meeting");
    }

    // Update call with Chime meeting ID
    await callService.updateChimeMeetingId(
      call.sessionId,
      meeting.Meeting.MeetingId
    );

    // Create attendee for the caller
    const clientId = generateClientId();
    const attendeeResponse = await chime.createAttendee({
      MeetingId: meeting.Meeting.MeetingId,
      ExternalUserId: `${data.initiatedBy}#${clientId}`,
    });

    if (!attendeeResponse.Attendee) {
      throw new Error("Failed to create Chime attendee for caller");
    }

    // Update caller's participant status
    await callService.updateParticipantStatus(
      call.sessionId,
      data.initiatedBy,
      "JOINED",
      attendeeResponse.Attendee.AttendeeId
    );

    // Get updated call record
    const updatedCall = await callService.getCall(call.sessionId);

    return {
      call: updatedCall!,
      meeting: meeting.Meeting,
      attendee: attendeeResponse.Attendee,
    };
  },

  /**
   * Accept call and create Chime meeting
   * Called when recipient accepts the call
   * Atomically: creates meeting, updates call record, creates attendees for all parties
   * Works for both DIRECT (2 participants) and GROUP (N participants) calls
   */
  async acceptCall(data: {
    sessionId: string;
    recipientId: string;
  }): Promise<{ call: Call; meeting: Meeting; attendee: Attendee }> {
    try {
      // 1. Get call record
      const call = await callService.getCall(data.sessionId);
      if (!call || !call.chimeMeetingId) {
        throw new Error("Call or meeting not found");
      }

      // Verify recipient is actually a participant
      const isParticipant = call.participants.some(
        (p) => p.userId === data.recipientId
      );
      if (!isParticipant) {
        throw new Error("User is not a participant in this call");
      }

      // 2. Create Chime attendee for the recipient
      const clientId = generateClientId();
      const attendeeResponse = await chime.createAttendee({
        MeetingId: call.chimeMeetingId,
        ExternalUserId: `${data.recipientId}#${clientId}`,
      });

      if (!attendeeResponse.Attendee) {
        throw new Error("Failed to create Chime attendee for recipient");
      }
      
      // 3. Update recipient's participant status
      await callService.updateParticipantStatus(
        data.sessionId,
        data.recipientId,
        "JOINED",
        attendeeResponse.Attendee.AttendeeId
      );

      // 4. If this is the first user to accept, update call status to ACTIVE
      if (call.status === "RINGING") {
        await callService.updateCallStatus(data.sessionId, "ACTIVE");
      }

      // 5. Get Chime meeting details to return
      const meeting = await chime.getMeeting({
        MeetingId: call.chimeMeetingId,
      });

      if (!meeting.Meeting) {
        throw new Error("Failed to get Chime meeting details");
      }

      // 6. Get updated call record
      const updatedCall = await callService.getCall(data.sessionId);

      return {
        call: updatedCall!,
        meeting: meeting.Meeting,
        attendee: attendeeResponse.Attendee,
      };
    } catch (error) {
      console.error("Error in acceptCall:", error);
      throw error;
    }
  },

  /**
   * Reject a call
   */
  async rejectCall(sessionId: string, userId: string): Promise<void> {
    const call = await callService.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Update participant status
    await callService.updateParticipantStatus(sessionId, userId, "REJECTED");

    // If all participants rejected, mark call as REJECTED
    const allRejected = call.participants.every(
      (p) => p.status === "REJECTED" || p.userId === call.initiatedBy
    );

    if (allRejected) {
      await callService.updateCallStatus(sessionId, "REJECTED");
    }
  },

  /**
   * Leave a call
   * If the caller (initiatedBy) leaves a GROUP call, they must specify the new owner
   * For DIRECT calls, the call simply ends when any participant leaves
   * Returns the updated call and the new owner ID (if ownership was transferred)
   */
  async leaveCall(
    sessionId: string,
    userId: string,
    newOwnerId?: string
  ): Promise<{ call: Call; newOwnerId: string | null }> {
    const call = await callService.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Get remaining active participants (not LEFT or REJECTED) excluding the leaving user
    const remainingActiveParticipants = call.participants.filter(
      (p) =>
        p.userId !== userId &&
        p.status !== "LEFT" &&
        p.status !== "REJECTED"
    );

    // For GROUP calls, if the initiator is leaving, they must specify a new owner
    const isInitiator = call.initiatedBy === userId;
    const isCurrentOwner =
      isInitiator ||
      call.participants.some(
        (p) => p.userId === userId && p.becameCallOwner?.status === true
      );

    if (
      call.callType === "GROUP" &&
      isCurrentOwner &&
      remainingActiveParticipants.length > 0
    ) {
      if (!newOwnerId) {
        throw new Error(
          "Call owner must specify a new owner before leaving a group call"
        );
      }

      // Verify the new owner is a valid remaining participant
      const isValidNewOwner = remainingActiveParticipants.some(
        (p) => p.userId === newOwnerId
      );
      if (!isValidNewOwner) {
        throw new Error("New owner must be an active participant in the call");
      }

      // Transfer ownership
      await callService.transferCallOwnership(sessionId, userId, newOwnerId);
    }

    // Update participant status to LEFT
    await callService.updateParticipantStatus(sessionId, userId, "LEFT");

    // If all participants left, mark call as ENDED
    if (remainingActiveParticipants.length === 0) {
      await callService.updateCallStatus(sessionId, "ENDED");
    }

    return { call, newOwnerId: newOwnerId || null };
  },
  /**
   * Cancel a ringing call (caller only)
   * Used when caller hangs up before recipient answers
   */
  async cancelCall(sessionId: string, callerId: string): Promise<Call> {
    const call = await callService.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Only the caller (initiator) can cancel
    if (call.initiatedBy !== callerId) {
      throw new Error("Only the caller can cancel a ringing call");
    }

    // Can only cancel calls that are still ringing
    if (call.status !== "RINGING") {
      throw new Error(
        `Cannot cancel call. Current status: ${call.status}`
      );
    }

    // Update call status to CANCELLED
    await callService.updateCallStatus(sessionId, "CANCELLED");

    return call;
  },

  /**
   * End an active call
   */
  async endCall(sessionId: string): Promise<Call> {
    const call = await callService.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Delete Chime meeting if it exists
    if (call.chimeMeetingId) {
      try {
        await chime.deleteMeeting({
          MeetingId: call.chimeMeetingId,
        });
      } catch (error) {
        console.error("Error deleting Chime meeting:", error);
        // Continue with DB update even if Chime deletion fails
      }
    }

    // Update call status to ENDED
    await callService.endCall(sessionId);
    return call;
  },
};
