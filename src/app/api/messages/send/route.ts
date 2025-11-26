import { messageService } from "@/services/messageService";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Verify the senderId matches the authenticated user
    if (!verifyUserMatch(body.senderId, auth.userId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Cannot send messages as another user",
        },
        { status: 403 }
      );
    }
    const { conversationId, content, type = "TEXT", tempId } = body;

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "conversationId and content are required" },
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

    // Save message to DynamoDB
    const message = await messageService.sendMessage({
      conversationId,
      senderId: auth.userId,
      content,
      type,
    });

    // Update conversation last message timestamp
    await conversationService.updateLastMessage(
      conversationId,
      message.timestamp
    );

    // USER-CENTRIC: Publish to each participant's channel
    // (conversation was already fetched above for participant check)
    // For a 2-person chat, this publishes to 2 channels
    // For a 10-person group, this publishes to 10 channels
    await publishToUsers(
      conversation.participants,
      "/chats",
      {
        type: "MESSAGE_SENT",
        data: {
          ...message,
          tempId, // Include tempId for optimistic update matching
        },
      },
      auth.idToken
    );

    return NextResponse.json({
      success: true,
      messageId: message.messageId,
      tempId,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 }
    );
  }
}
