import { NextRequest, NextResponse } from "next/server"
import { userService } from "@/services/userService"
import { getAuthenticatedUser } from "@/lib/auth/api-auth"

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request - user must be logged in to create their profile
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { firstName, lastName } = body;

    // Check if the required fields are there
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await userService.getUser(auth.userId);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create the user (use authenticated userId and email)
    const newUser = await userService.createUser({
      userId: auth.userId,
      email: auth.email || body.email, // Prefer email from token
      firstName: firstName.toLowerCase(),
      lastName: lastName.toLowerCase(),
    });

    return NextResponse.json(
      { message: 'User profile created successfully', user: newUser },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}