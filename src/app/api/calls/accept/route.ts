import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/accept
 * Accept an incoming call and create Chime meeting
 * Works for both DIRECT and GROUP calls
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

    // Accept the call and create Chime meeting
    // This creates attendees for ALL participants (works for both direct and group calls)
    const result = await callManager.acceptAndConnectCall({
      sessionId,
      recipientId: auth.userId,
    });

    // Verify the call was connected successfully
    if (!result.meeting || !result.meeting.MeetingId) {
      return NextResponse.json(
        { error: "Failed to create meeting" },
        { status: 500 }
      );
    }

    // Prepare connection data for all participants
    const connectionData = {
      sessionId,
      meeting: {
        MeetingId: result.meeting.MeetingId,
        MediaPlacement: result.meeting.MediaPlacement,
      },
      attendees: result.attendees,
    };

    // Get all participant IDs from the call
    const participantIds = result.call.participants.map((p) => p.userId);

    // Notify all participants that the call is connected
    await publishToUsers(
      participantIds,
      "/calls",
      {
        type: "CALL_CONNECTED",
        data: connectionData,
      },
      auth.idToken
    );

    console.log(`[Calls] Call accepted and connected: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      meeting: connectionData.meeting,
      attendee: result.attendees[auth.userId],
    });
  } catch (error) {
    console.error("Error accepting call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to accept call";

    // Return specific error codes based on error type
    if (errorMessage === "Call not found") {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (errorMessage.includes("not in ringing state")) {
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    if (errorMessage === "User is not a participant in this call") {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
