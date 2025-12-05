import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { callService } from "@/services/callService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/leave
 * Leave an active call without ending it for other participants
 *
 * For GROUP calls: If the call owner (initiatedBy or current owner) is leaving,
 * they MUST specify a newOwnerId to transfer ownership to.
 *
 * For DIRECT calls: No ownership transfer is needed.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, newOwnerId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Verify user is a participant before leaving
    const call = await callService.getCall(sessionId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const isParticipant = call.participants.some(
      (p) => p.userId === auth.userId
    );
    if (!isParticipant) {
      return NextResponse.json(
        { error: "You are not a participant in this call" },
        { status: 403 }
      );
    }

    // Leave the call (handles ownership transfer if needed)
    // For GROUP calls, if user is the owner, newOwnerId is required
    const { call: updatedCall, newOwnerId: transferredOwnerId } =
      await callManager.leaveCall(sessionId, auth.userId, newOwnerId);

    // Get other participant IDs (excluding the user who left)
    const otherParticipantIds = updatedCall.participants
      .filter((p) => p.userId !== auth.userId)
      .map((p) => p.userId);

    // Notify other participants that this user left
    if (otherParticipantIds.length > 0) {
      await publishToUsers(
        otherParticipantIds,
        "/calls",
        {
          type: "PARTICIPANT_LEFT",
          data: {
            sessionId,
            userId: auth.userId,
            newOwnerId: transferredOwnerId, // null if no ownership transfer occurred
          },
        },
        auth.idToken
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(
      `[Calls] User ${auth.userId} left call ${sessionId}${
        transferredOwnerId
          ? `, ownership transferred to ${transferredOwnerId}`
          : ""
      }`
    );

    return NextResponse.json({
      success: true,
      sessionId,
      newOwnerId: transferredOwnerId,
    });
  } catch (error) {
    console.error("Error leaving call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to leave call";

    if (errorMessage === "Call not found") {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (
      errorMessage.includes("must specify a new owner") ||
      errorMessage.includes("must be an active participant")
    ) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
