import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { callService } from "@/services/callService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/end
 * End an active call
 * Only the call owner (initiatedBy or participant with becameCallOwner.status = true) can end the call
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

    // Verify user is the call owner before ending
    const call = await callService.getCall(sessionId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const isInitiator = call.initiatedBy === auth.userId;
    const isCurrentOwner = call.participants.some(
      (p) => p.userId === auth.userId && p.becameCallOwner?.status === true
    );

    if (!isInitiator && !isCurrentOwner) {
      return NextResponse.json(
        { error: "Only the call owner can end the call" },
        { status: 403 }
      );
    }

    // End the call (deletes Chime meeting and updates status)
    await callManager.endCall(sessionId);

    // Get all participant IDs
    const participantIds = call.participants.map((p) => p.userId);

    // Notify all participants that the call has ended
    await publishToUsers(
      participantIds,
      "/calls",
      {
        type: "CALL_ENDED",
        data: {
          sessionId,
          endedBy: auth.userId,
        },
      },
      auth.idToken
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`[Calls] Call ended: ${sessionId} by ${auth.userId}`);

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Error ending call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to end call";

    if (errorMessage === "Call not found") {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
