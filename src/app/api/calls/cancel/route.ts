import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/chime/callManager";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

/**
 * POST /api/calls/cancel
 * Cancel a ringing call (caller only)
 * Used when caller hangs up before recipient answers
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

    // Cancel the call (only caller can cancel)
    const call = await callManager.cancelCall(sessionId, auth.userId);

    // Get recipient IDs (all participants except the caller)
    const recipientIds = call.participants
      .filter((p) => p.userId !== auth.userId)
      .map((p) => p.userId);

    // Notify all recipients that the call was cancelled
    await publishToUsers(
      recipientIds,
      "/calls",
      {
        type: "CALL_CANCELLED",
        data: {
          sessionId,
          cancelledBy: auth.userId,
        },
      },
      auth.idToken
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`[Calls] Call cancelled: ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Error cancelling call:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to cancel call";

    // Return specific error codes based on error type
    if (errorMessage === "Call not found") {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    if (errorMessage === "Only the caller can cancel a ringing call") {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    if (errorMessage.includes("Cannot cancel call")) {
      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
