import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/calls/:sessionId/participant-update
 * Update participant status in a call (join, leave, decline, ringing)
 *
 * Auth: Required (must be the participant updating their own status)
 * Params: sessionId
 * Query: timestamp
 * Body: { status: 'JOINED' | 'LEFT' | 'DECLINED' | 'RINGING', chimeAttendeeId?: string }
 * Returns: {success: true}
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.get("authorization"))
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { userId } = authResult

    // Await params in Next.js 15+
    const { sessionId } = await params

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
    const timestamp = req.nextUrl.searchParams.get("timestamp")
    const { status, chimeAttendeeId } = body

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

    // Validate status is provided
    if (!status) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_STATUS",
          message: "status field is required (JOINED|LEFT|DECLINED|RINGING)",
        },
        { status: 400 }
      )
    }

    // Validate status value
    if (!["JOINED", "LEFT", "DECLINED", "RINGING"].includes(status)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_STATUS",
          message: "status must be one of: JOINED, LEFT, DECLINED, RINGING",
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

    // Handle DECLINED status - they decline to participate
    if (status === "DECLINED") {
      // Remove participant from call
      await chimeService.updateParticipantStatus(
        sessionId,
        timestamp,
        userId,
        "DECLINED",
        chimeAttendeeId
      )
      return NextResponse.json(
        {
          success: true,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      )
    }

    // For other statuses, update participant
    await chimeService.updateParticipantStatus(
      sessionId,
      timestamp,
      userId,
      status,
      chimeAttendeeId
    )

    // If all participants have declined or left, end the call
    const updatedSession = await chimeService.getCallSessionById(sessionId, timestamp)
    if (updatedSession) {
      const activeParticipants = updatedSession.participants.filter(
        (p) => p.status === "JOINED" || p.status === "RINGING"
      )

      // Auto-end call if no active participants remain
      if (activeParticipants.length === 0 && updatedSession.status !== "ENDED") {
        await chimeService.endCallSession(sessionId, timestamp, "NO_PARTICIPANTS")
      }
    }

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error updating participant status:", error)

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to update participant status. Please try again later.",
      },
      { status: 500 }
    )
  }
}
