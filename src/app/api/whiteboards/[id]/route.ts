import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { whiteboardService } from "@/services/whiteboardService";
import { logDebug } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate the user
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const whiteboardId = params.id;
    logDebug(`Fetching whiteboard with ID: ${whiteboardId} for user ${authUser.userId}`);

    // 2. Fetch the whiteboard data
    const whiteboard = await whiteboardService.getWhiteboard(whiteboardId);

    if (!whiteboard) {
      return NextResponse.json(
        { success: false, error: "Whiteboard not found" },
        { status: 404 }
      );
    }

    // 3. Verify permissions - check if user is a participant
    if (!whiteboard.participants.includes(authUser.userId)) {
      logDebug(`Permission denied for user ${authUser.userId} on whiteboard ${whiteboardId}`);
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 4. Return the whiteboard data
    return NextResponse.json({ success: true, whiteboard });
    
  } catch (error) {
    logDebug(`Error fetching whiteboard ${params.id}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
