import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { callService } from "@/services/callService";
import { whiteboardService } from "@/services/whiteboardService";
import { userService } from "@/services/userService";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, whiteboardId } = await req.json();

    // 1. Validate call exists and user is participant
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

    // 2. Get whiteboard and validate permissions
    const whiteboard = await whiteboardService.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      return NextResponse.json(
        { error: "Whiteboard not found" },
        { status: 404 }
      );
    }

    // 3. Add all call participants as whiteboard participants
    const participantIds = call.participants.map((p) => p.userId);
    for (const userId of participantIds) {
      if (!whiteboard.participants.includes(userId)) {
        await whiteboardService.addParticipant(whiteboardId, userId);
      }
    }

    // 4. Get current user's name
    const currentUser = await userService.getUser(authUser.userId);
    const currentUserName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : authUser.userId;

    // 5. Publish event to all call participants
    await publishToUsers(
      participantIds,
      "/calls",
      {
        type: "WHITEBOARD_OPENED_IN_CALL",
        data: {
          sessionId,
          whiteboardId,
          whiteboardName: whiteboard.name,
          conversationId: whiteboard.conversationId,
          openedBy: authUser.userId,
          openedByName: currentUserName,
          snapshot: whiteboard.snapshot,
          timestamp: new Date().toISOString(),
        },
      },
      authUser.idToken
    );

    return NextResponse.json({ success: true, whiteboard });
  } catch (error) {
    console.error("Error opening whiteboard in call:", error);
    return NextResponse.json(
      { error: "Failed to open whiteboard" },
      { status: 500 }
    );
  }
}
