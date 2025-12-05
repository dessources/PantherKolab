import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { callService } from "@/services/callService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/reject
 * Reject an incoming call
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

    // Get the call to find the caller
    const call = await callService.getCall(sessionId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Verify user is a participant
    const isParticipant = call.participants.some(
      (p) => p.userId === auth.userId
    );
    if (!isParticipant) {
      return NextResponse.json(
        { error: "You are not a participant in this call" },
        { status: 403 }
      );
    }

    // Update call record (marks participant as REJECTED, may update call status)
    await callManager.rejectCall(sessionId, auth.userId);

    // Notify the caller that the call was rejected
    await publishToUsers(
      [call.initiatedBy],
      "/calls",
      {
        type: "CALL_REJECTED",
        data: {
          sessionId,
          rejectedBy: auth.userId,
        },
      },
      auth.idToken
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`[Calls] Call rejected: ${sessionId} by ${auth.userId}`);

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Error rejecting call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to reject call";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
