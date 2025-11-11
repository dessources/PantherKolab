import { NextResponse } from "next/server";
import { conversationService } from "@/services/conversationService";

export async function GET(request: Request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const userId = payload.sub;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    const conversations = await conversationService.listConversations(userId);

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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const userId = payload.sub;

    const body = await request.json();

    const conversation = await conversationService.createConversation({
      type: body.type,
      name: body.name,
      description: body.description,
      participants: body.participants,
      createdBy: userId, // From token, not body
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
