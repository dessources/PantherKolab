import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { callService } from "@/services/callService";
import { userService } from "@/services/userService";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, whiteboardId } = await req.json();

    // 1. Validate call
    const call = await callService.getCall(sessionId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const isParticipant = call.participants.some(
      (p) => p.userId === authUser.userId
    );
    if (!isParticipant) {
      return NextResponse.json(
        { error: "Not a call participant" },
        { status: 403 }
      );
    }

    // 2. Get current user's name
    const currentUser = await userService.getUser(authUser.userId);
    const currentUserName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : authUser.userId;

    // 3. Publish close event to all participants
    const participantIds = call.participants.map((p) => p.userId);
    await publishToUsers(
      participantIds,
      "/calls",
      {
        type: "WHITEBOARD_CLOSED_IN_CALL",
        data: {
          sessionId,
          whiteboardId,
          closedBy: authUser.userId,
          closedByName: currentUserName,
          timestamp: new Date().toISOString(),
        },
      },
      authUser.idToken
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error closing whiteboard in call:", error);
    return NextResponse.json(
      { error: "Failed to close whiteboard" },
      { status: 500 }
    );
  }
}
