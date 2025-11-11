import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/services/userService";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { fetchAuthSession } from "aws-amplify/auth";

// Get a specific user profile
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  tokenUse: "id",
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id: userId } = await params;

    // Get token from Authorization header
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - No token" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify the JWT token
    const payload = await verifier.verify(token);
    const loggedInUserId = payload.sub;

    console.log("Requested userId:", userId);
    console.log("Logged in userId:", loggedInUserId);

    // Check if user is viewing their own profile
    const isOwnProfile = loggedInUserId === userId;

    // Get user from DynamoDB
    const user = await userService.getUser(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user, isOwnProfile }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { id: userId } = await params;

    const session = await fetchAuthSession();
    const tokenUserId = session.tokens?.idToken?.payload.sub as string;

    const updates = await req.json();
    const existingUser = await userService.getUser(userId);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId: _userId, email, createdAt, ...allowedUpdates } = updates;

    const updatedUser = await userService.updateUser(userId, allowedUpdates);

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
