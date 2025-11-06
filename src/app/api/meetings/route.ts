import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * GET /api/meetings
 * Get user's scheduled meetings
 *
 * Auth: Required
 * Query: limit (default 20), offset (default 0)
 * Returns: {success: true, data: {meetings: Meeting[], total: number}}
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // Get user's meetings
    const meetings = await chimeService.getUserMeetings(userId)

    return NextResponse.json(
      {
        success: true,
        data: {
          meetings,
          total: meetings.length,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching meetings:", error)

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to fetch meetings. Please try again later.",
      },
      { status: 500 }
    )
  }
}