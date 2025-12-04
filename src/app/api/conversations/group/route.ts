import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, memberIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "At least one member is required for a group" },
        { status: 400 }
      );
    }

    const newConversation = await conversationService.createGroupConversation(
      name.trim(),
      memberIds,
      auth.userId
    );

    return NextResponse.json({ conversation: newConversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating group conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
