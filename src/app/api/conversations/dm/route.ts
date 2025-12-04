import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/services/conversationService";
import { userService } from "@/services/userService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

/**
 * POST /api/conversations/dm
 * Find or create a DM conversation with another user
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId: otherUserId } = body;

    // Validate input
    if (!otherUserId || typeof otherUserId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Prevent creating DM with self
    if (otherUserId === auth.userId) {
      return NextResponse.json(
        { error: "Cannot create DM with yourself" },
        { status: 400 }
      );
    }

    // Get the other user's profile to use their name
    const otherUser = await userService.getUser(otherUserId);
    if (!otherUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find or create the DM conversation
    const conversation = await conversationService.findOrCreateDM(
      auth.userId,
      otherUserId,
      `${otherUser.firstName} ${otherUser.lastName}`
    );

    return NextResponse.json(
      {
        success: true,
        conversation,
        otherUser: {
          userId: otherUser.userId,
          fullName: otherUser.fullName,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          profilePicture: otherUser.profilePicture,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error creating DM:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
