import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/calls/:sessionId/end
 * End a call session and cleanup Chime resources
 *
 * Auth: Required (must be call initiator)
 * Params: sessionId
 * Query: timestamp
 * Body: { endReason: string }
 * Returns: {success: true}
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

    const sessionId = params.sessionId
    const timestamp = req.nextUrl.searchParams.get("timestamp")
    const { endReason } = body

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

    // Validate endReason is provided
    if (!endReason || typeof endReason !== "string") {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_END_REASON",
          message: "endReason field is required (string)",
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

    // Verify user is the call initiator
    if (callSession.initiatorId !== userId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          code: "NOT_INITIATOR",
          message: "Only the call initiator can end the call",
        },
        { status: 403 }
      )
    }

    // Check if call is already ended
    if (callSession.status === "ENDED") {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "CALL_ALREADY_ENDED",
          message: "This call session has already ended",
        },
        { status: 400 }
      )
    }

    // End the call session
    await chimeService.endCallSession(sessionId, timestamp, endReason)

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error ending call:", error)

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
        message: "Failed to end call. Please try again later.",
      },
      { status: 500 }
    )
  }
}
