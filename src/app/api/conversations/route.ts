import { NextResponse } from "next/server";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function GET() {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const conversations = await conversationService.listConversations(
      auth.userId
    );

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const conversation = await conversationService.createConversation({
      type: body.type,
      name: body.name,
      description: body.description,
      participants: body.participants,
      createdBy: auth.userId, // From authenticated session
      avatar: body.avatar,
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
