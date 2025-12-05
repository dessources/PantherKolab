import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/services/conversationService";
import { userService } from "@/services/userService";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";
import { callManager } from "@/lib/chime/callManager";
import type { CallType } from "@/types/database";

/**
 * POST /api/calls/initiate
 * Create a call record and return call details
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { callType, initiatedBy, participantIds, conversationId } = body as {
      callType: CallType;
      initiatedBy: string;
      participantIds: string[];
      conversationId?: string;
    };

    // Verify the initiatedBy matches the authenticated user
    if (!verifyUserMatch(initiatedBy, auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: Cannot initiate calls as another user" },
        { status: 403 }
      );
    }

    // Validate input
    if (
      !callType ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields: callType, participantIds" },
        { status: 400 }
      );
    }

    // Validate call type
    if (callType !== "DIRECT" && callType !== "GROUP") {
      return NextResponse.json({ error: "Invalid call type" }, { status: 400 });
    }

    // Verify all participants exist
    const userExistencePromises = participantIds.map((id) =>
      userService.getUser(id)
    );
    const userExistenceResults = await Promise.all(userExistencePromises);

    if (userExistenceResults.some((user) => user === null)) {
      const invalidUserIdIndex = userExistenceResults.findIndex(
        (user) => user === null
      );
      const invalidUserId = participantIds[invalidUserIdIndex];
      return NextResponse.json(
        { error: `Participant with ID '${invalidUserId}' not found.` },
        { status: 404 }
      );
    }

    // For GROUP calls, validate conversationId and participants
    if (callType === "GROUP") {
      if (!conversationId) {
        return NextResponse.json(
          { error: "Group calls require a conversationId" },
          { status: 400 }
        );
      }

      // Get conversation to verify it exists and get participants
      const conversation = await conversationService.getConversation(
        conversationId
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      // Verify all participantIds are in the conversation
      const invalidParticipants = participantIds.filter(
        (id) => !conversation.participants.includes(id)
      );

      if (invalidParticipants.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot add users outside the group to a group call",
            invalidParticipants,
          },
          { status: 400 }
        );
      }
    }

    // For DIRECT calls, limit to 2 participants
    if (callType === "DIRECT" && participantIds.length !== 2) {
      return NextResponse.json(
        { error: "Direct calls must have exactly two recipients" },
        { status: 400 }
      );
    }

    // For DIRECT calls without conversationId, create or find DM conversation
    let finalConversationId = conversationId;
    if (callType === "DIRECT" && !conversationId) {
      // Get the other participant (not the caller)
      const otherParticipantId = participantIds.find((id) => id !== auth.userId);
      if (otherParticipantId) {
        try {
          // Get the other user's name for the DM
          const otherUser = await userService.getUser(otherParticipantId);
          const otherUserName = otherUser
            ? `${otherUser.firstName} ${otherUser.lastName}`
            : "Unknown User";

          // Find or create DM conversation
          const dmConversation = await conversationService.findOrCreateDM(
            auth.userId,
            otherParticipantId,
            otherUserName
          );
          finalConversationId = dmConversation.conversationId;
        } catch (error) {
          console.error("Failed to create/find DM for direct call:", error);
          // Continue without conversationId - it's optional for direct calls
        }
      }
    }

    // Initiate call, which now creates the Chime meeting
    const { call, meeting, attendee } = await callManager.initiateCall({
      callType,
      initiatedBy: auth.userId,
      participantIds,
      conversationId: finalConversationId,
    });

    // Verify call was created successfully
    if (!call || !call.sessionId) {
      return NextResponse.json(
        { error: "Failed to create call session" },
        { status: 500 }
      );
    }

    // Get caller info for notifications
    const caller = await userService.getUser(auth.userId);
    const callerName = caller
      ? `${caller.firstName} ${caller.lastName}`
      : "Unknown";

    // Determine call media type (AUDIO or VIDEO) - default to AUDIO for now
    const mediaType = "AUDIO" as const;

    // Notify the caller that they are "connected" to the meeting immediately
    await publishToUsers(
      [auth.userId],
      "/calls",
      {
        type: "CALL_CONNECTED",
        data: {
          sessionId: call.sessionId,
          conversationId: call.conversationId,
          callType: call.callType,
          meeting,
          attendees: { [auth.userId]: attendee },
        },
      },
      auth.idToken
    );

    // Notify all recipients but the caller about the incoming call
    await publishToUsers(
      participantIds.filter((p) => p !== auth.userId),
      "/calls",
      {
        type: "INCOMING_CALL",
        data: {
          sessionId: call.sessionId,
          callerId: auth.userId,
          callerName,
          callType: mediaType,
        },
      },
      auth.idToken
    );

    return NextResponse.json({
      success: true,
      call,
      meeting,
      attendee,
    });
  } catch (error) {
    console.error("Call initiation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}