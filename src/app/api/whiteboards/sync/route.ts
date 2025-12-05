import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { whiteboardService } from "@/services/whiteboardService";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";
import { logDebug } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    const body = await request.json();
    const { whiteboardId, snapshot } = body;

    if (!whiteboardId || !snapshot) {
      return NextResponse.json(
        { success: false, error: "whiteboardId and snapshot are required" },
        { status: 400 }
      );
    }

    // 3. Fetch whiteboard to verify permissions
    const whiteboard = await whiteboardService.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      return NextResponse.json(
        { success: false, error: "Whiteboard not found" },
        { status: 404 }
      );
    }

    if (!whiteboard.participants.includes(authUser.userId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Not a participant" },
        { status: 403 }
      );
    }

    // 4. NEW: Verify user is the owner before allowing changes
    if (whiteboard.createdBy !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only the owner can make changes" },
        { status: 403 }
      );
    }

    // 5. Update the snapshot in DynamoDB
    await whiteboardService.updateWhiteboardSnapshot(whiteboardId, snapshot);

    // 6. Publish the change to all other participants via AppSync
    const participantsToNotify = whiteboard.participants.filter(
      (p) => p !== authUser.userId
    );

    if (participantsToNotify.length > 0) {
      logDebug(`Publishing whiteboard update for ${whiteboardId} to ${participantsToNotify.length} participants.`);
      await publishToUsers(
        participantsToNotify,
        "/whiteboards", // The channel is /whiteboards/{userId}
        {
          type: "WHITEBOARD_UPDATED",
          data: {
            whiteboardId,
            snapshot,
            updatedBy: authUser.userId,
          },
        },
        authUser.idToken
      );
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    logDebug("Error syncing whiteboard:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
