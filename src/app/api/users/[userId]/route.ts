import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/services/userService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const { userId } = await params;

    // Check if user is viewing their own profile
    const isOwnProfile = auth.userId === userId;

    // Get user from DynamoDB
    const user = await userService.getUser(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user, isOwnProfile }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const { userId } = await params;

    // Only allow updating your own profile
    if (auth.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own profile" },
        { status: 403 }
      );
    }

    const updates = await req.json();
    const existingUser = await userService.getUser(userId);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId: _userId, email, createdAt, ...allowedUpdates } = updates;

    const updatedUser = await userService.updateUser(
      userId,
      allowedUpdates
    );

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}