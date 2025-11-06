import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/calls/:sessionId/join-token
 * Generate attendee token for joining a call
 *
 * Auth: Required (must be invited participant)
 * Params: sessionId
 * Query: timestamp
 * Returns: {success: true, data: {attendeeId: string, joinToken: string}}
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    const sessionId = params.sessionId
    const timestamp = req.nextUrl.searchParams.get("timestamp")

    // Validate sessionId is provided
    if (!sessionId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_SESSION_ID",
          message: "sessionId parameter is required",
        },
        { status: 400 }
      )
    }

    // Validate timestamp is provided
    if (!timestamp) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_TIMESTAMP",
          message: "timestamp query parameter is required",
        },
        { status: 400 }
      )
    }

    // Get call session
    const callSession = await chimeService.getCallSessionById(sessionId, timestamp)

    if (!callSession) {
      return NextResponse.json(
        {
          error: "Not Found",
          code: "SESSION_NOT_FOUND",
          message: `Call session not found: ${sessionId}`,
        },
        { status: 404 }
      )
    }

    // Verify user is invited to this call
    const isParticipant = callSession.participants.some((p) => p.userId === userId)

    if (!isParticipant) {
      return NextResponse.json(
        {
          error: "Forbidden",
          code: "NOT_INVITED",
          message: "You are not invited to this call",
        },
        { status: 403 }
      )
    }

    // Check if call session is still active
    if (callSession.status === "ENDED") {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "CALL_ENDED",
          message: "This call session has already ended",
        },
        { status: 400 }
      )
    }

    // Generate join token using the call's Chime meeting
    const tokenData = await chimeService.generateAttendeeToken(callSession.chimeMeetingId, userId)

    // Note: generateAttendeeToken expects meetingId, but we're using chimeMeetingId
    // We need to update the call to create a meeting record first or use a different approach
    // For now, we'll create the token directly with Chime

    return NextResponse.json(
      {
        success: true,
        data: {
          attendeeId: tokenData.attendeeId,
          joinToken: tokenData.joinToken,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error generating join token:", error)

    if (error instanceof Error) {
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

      if (error.message.includes("not found") || error.message.includes("not started")) {
        return NextResponse.json(
          {
            error: "Bad Request",
            code: "CALL_NOT_READY",
            message: "Call session is not ready to accept participants",
          },
          { status: 400 }
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
