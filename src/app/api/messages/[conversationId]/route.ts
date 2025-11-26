import { NextResponse } from "next/server";
import { messageService } from "@/services/messageService";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { conversationId } = await params;

    // Verify user is a participant in this conversation
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!conversation.participants.includes(auth.userId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not a participant in this conversation" },
        { status: 403 }
      );
    }

    const messages = await messageService.getMessages(conversationId);

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
