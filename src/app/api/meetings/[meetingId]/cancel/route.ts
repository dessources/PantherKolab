import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/meetings/:meetingId/cancel
 * Cancel a meeting before it starts
 *
 * Auth: Required (must be meeting creator)
 * Params: meetingId
 * Returns: {success: true}
 */
export async function POST(
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

    // Get meeting to verify user is the creator
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

    // Verify user is the meeting creator
    if (meeting.creatorId !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          code: "NOT_MEETING_CREATOR",
          message: "Only the meeting creator can cancel the meeting",
        },
        { status: 403 }
      )
    }

    // Check if meeting has already started
    if (meeting.status === "ACTIVE" || meeting.status === "ENDED") {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_STATUS",
          message: `Cannot cancel a meeting with status: ${meeting.status}`,
        },
        { status: 400 }
      )
    }

    // Cancel the meeting
    await chimeService.cancelMeeting(meetingId)

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error cancelling meeting:", error)

    if (error instanceof Error) {
      if (error.message.includes("quota") || error.message.includes("Quota")) {
        return NextResponse.json(
          {
            error: "Service Limit",
            code: "CHIME_QUOTA_EXCEEDED",
            message: "Chime meeting quota exceeded. Please try again later.",
          },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to cancel meeting. Please try again later.",
      },
      { status: 500 }
    )
  }
}
