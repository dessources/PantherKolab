import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/accept
 * Accept an incoming call and join the Chime meeting
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Accept the call and create a new attendee for the meeting
    const { call, meeting, attendee } = await callManager.acceptCall({
      sessionId,
      recipientId: auth.userId,
    });

    // Verify the call was connected successfully
    if (!meeting || !meeting.MeetingId) {
      return NextResponse.json(
        { error: "Failed to connect to meeting" },
        { status: 500 }
      );
    }

    const allParticipantIds = call.participants.map((p) => p.userId);
    const otherParticipantIds = allParticipantIds.filter(
      (id) => id !== auth.userId
    );

    // Notify the accepting user they are connected
    await publishToUsers(
      [auth.userId],
      "/calls",
      {
        type: "CALL_CONNECTED",
        data: {
          sessionId,
          conversationId: call.conversationId,
          callType: call.callType,
          meeting,
          attendees: { [auth.userId]: attendee },
        },
      },
      auth.idToken
    );

    // Notify other participants that this user has joined
    await publishToUsers(
      otherParticipantIds,
      "/calls",
      {
        type: "PARTICIPANT_JOINED",
        data: {
          sessionId,
          userId: auth.userId,
          attendee,
        },
      },
      auth.idToken
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`[Calls] User ${auth.userId} accepted and joined call ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      meeting,
      attendee,
    });
  } catch (error) {
    console.error("Error accepting call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to accept call";

    // Return specific error codes based on error type
    if (errorMessage.includes("not found")) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (errorMessage.includes("not in ringing state")) {
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    if (errorMessage.includes("not a participant")) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}