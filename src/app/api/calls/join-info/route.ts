import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/calls/join-info
 * Get meeting credentials and join token for a call session
 *
 * Auth: Required (must be invited participant)
 * Body: { sessionId: string, timestamp: string }
 * Returns: {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     chimeMeetingId: string,
 *     attendeeId: string,
 *     joinToken: string,
 *     callType: string,
 *     initiatorId: string,
 *     participants: CallParticipant[]
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_JSON",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      )
    }

    const { sessionId, timestamp } = body

    // Validate required fields
    if (!sessionId || !timestamp) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_REQUIRED_FIELDS",
          message: "sessionId and timestamp are required",
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

    // Return complete join info needed for Chime SDK initialization
    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId: callSession.sessionId,
          chimeMeetingId: callSession.chimeMeetingId,
          attendeeId: tokenData.attendeeId,
          joinToken: tokenData.joinToken,
          callType: callSession.callType,
          initiatorId: callSession.initiatorId,
          participants: callSession.participants,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error getting join info:", error)

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
        message: "Failed to get join info. Please try again later.",
      },
      { status: 500 }
    )
  }
}
