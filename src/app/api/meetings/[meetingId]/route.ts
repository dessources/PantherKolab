import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * GET /api/meetings/:meetingId
 * Get meeting details
 *
 * Auth: Required (must have access to meeting)
 * Params: meetingId
 * Returns: {success: true, data: Meeting}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const meetingId = params.meetingId

    // Validate meetingId is provided
    if (!meetingId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_MEETING_ID",
          message: "meetingId parameter is required",
        },
        { status: 400 }
      )
    }

    // Get meeting
    const meeting = await chimeService.getMeetingById(meetingId)

    if (!meeting) {
      return NextResponse.json(
        {
          error: "Not Found",
          code: "MEETING_NOT_FOUND",
          message: `Meeting not found: ${meetingId}`,
        },
        { status: 404 }
      )
    }

    // Verify user has access to meeting
    const hasAccess = await chimeService.validateMeetingAccess(meetingId, userId)

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Forbidden",
          code: "NO_ACCESS",
          message: "You do not have access to this meeting",
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: meeting,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching meeting:", error)

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to fetch meeting. Please try again later.",
      },
      { status: 500 }
    )
  }
}
