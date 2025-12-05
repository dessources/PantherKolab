import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { whiteboardService } from "@/services/whiteboardService";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    const whiteboards =
      await whiteboardService.listWhiteboardsByConversation(conversationId);

    // Filter to only whiteboards where user is a participant
    const userWhiteboards = whiteboards.filter((wb) =>
      wb.participants.includes(authUser.userId)
    );

    return NextResponse.json({ whiteboards: userWhiteboards });
  } catch (error) {
    console.error("Error listing whiteboards:", error);
    return NextResponse.json(
      { error: "Failed to list whiteboards" },
      { status: 500 }
    );
  }
}
