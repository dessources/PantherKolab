import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { whiteboardService } from "@/services/whiteboardService";
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
    const { conversationId, name } = body;

    if (!conversationId || !name) {
      return NextResponse.json(
        { success: false, error: "conversationId and name are required" },
        { status: 400 }
      );
    }

    // TODO: Later, verify user is a participant in the conversation before creating.
    // This is a good practice seen in the `messages/send` route.

    // 3. Create the whiteboard via the service
    logDebug(
      `Creating whiteboard "${name}" for conversation ${conversationId}`
    );
    const newWhiteboard = await whiteboardService.createWhiteboard({
      conversationId,
      name,
      createdBy: authUser.userId,
    });

    // 4. Return the successful response
    return NextResponse.json(
      { success: true, whiteboard: newWhiteboard },
      { status: 201 }
    );
  } catch (error) {
    logDebug("Error creating whiteboard:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
