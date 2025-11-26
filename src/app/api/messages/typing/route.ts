import { NextRequest, NextResponse } from "next/server";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, isTyping } = await request.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Verify user is a participant in this conversation
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!conversation.participants.includes(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this conversation" },
        { status: 403 }
      );
    }

    // Get all OTHER participants (don't send typing to self)
    const otherParticipantIds = conversation.participants.filter(
      (id) => id !== auth.userId
    );

    // Publish to /chats channel (same as messages) for unified subscription
    await publishToUsers(
      otherParticipantIds,
      "/chats",
      {
        type: isTyping ? "USER_TYPING" : "USER_STOPPED_TYPING",
        data: {
          userId: auth.userId,
          conversationId,
        },
      },
      auth.idToken
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error publishing typing event:", error);
    return NextResponse.json(
      { error: "Failed to publish typing event" },
      { status: 500 }
    );
  }
}
