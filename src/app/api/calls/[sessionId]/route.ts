import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * GET /api/calls/:sessionId
 * Get call session details
 *
 * Auth: Required (must be a participant in the call)
 * Params: sessionId, timestamp (passed as query param)
 * Returns: {success: true, data: CallSession}
 */
export async function GET(
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

    // Verify user is a participant in the call
    const isParticipant = callSession.participants.some((p) => p.userId === userId)

    if (!isParticipant) {
      return NextResponse.json(
        {
          error: "Forbidden",
          code: "NOT_PARTICIPANT",
          message: "You are not a participant in this call",
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: callSession,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching call session:", error)

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to fetch call session. Please try again later.",
      },
      { status: 500 }
    )
  }
}
