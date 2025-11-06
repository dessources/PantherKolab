import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/meetings/:meetingId/join-token
 * Generate attendee token for joining a meeting
 *
 * Auth: Required (must have access to meeting)
 * Params: meetingId
 * Returns: {success: true, data: {attendeeId: string, joinToken: string}}
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const { meetingId } = await params

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

    // Generate join token
    const tokenData = await chimeService.generateAttendeeToken(meetingId, userId)

    return NextResponse.json(
      {
        success: true,
        data: tokenData,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error generating join token:", error)

    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("not started")) {
        return NextResponse.json(
          {
            error: "Bad Request",
            code: "MEETING_NOT_STARTED",
            message: "Meeting has not been started yet",
          },
          { status: 400 }
        )
      }

      if (error.message.includes("quota") || error.message.includes("Quota")) {
        return NextResponse.json(
          {
            error: "Service Limit",
            code: "CHIME_QUOTA_EXCEEDED",
            message: "Chime attendee quota exceeded. Please try again later.",
          },
          { status: 429 }
        )
      }

      if (error.message.includes("access")) {
        return NextResponse.json(
          {
            error: "Forbidden",
            code: "NO_ACCESS",
            message: error.message,
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to generate join token. Please try again later.",
      },
      { status: 500 }
    )
  }
}
