import { NextRequest, NextResponse } from "next/server"
import { userService } from "@/services/userService"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, firstName, lastName } = body;

    // Check if the required fields are there
    if (!userId || !email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, firstName, lastName' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await userService.getUser(userId);
    if (existingUser) { 
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create the user
    const newUser = await userService.createUser({
      userId,
      email,
      firstName,
      lastName,
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