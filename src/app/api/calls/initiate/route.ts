import { NextRequest, NextResponse } from "next/server"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/calls/initiate
 * Initiate a direct or group call
 *
 * Auth: Required
 * Body: { callType: 'DIRECT' | 'GROUP', conversationId?: string, participantIds: string[] }
 * Returns: {success: true, data: {sessionId: string, chimeMeetingId: string, participants: CallParticipant[]}}
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

    const { callType, conversationId, participantIds } = body

    // Validate required fields
    if (!callType || !participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_REQUIRED_FIELDS",
          message: "callType (DIRECT|GROUP) and participantIds array are required",
        },
        { status: 400 }
      )
    }

    // Validate callType
    if (!["DIRECT", "GROUP"].includes(callType)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_CALL_TYPE",
          message: "callType must be 'DIRECT' or 'GROUP'",
        },
        { status: 400 }
      )
    }

    // Validate participantIds is not empty
    if (participantIds.length === 0) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "NO_PARTICIPANTS",
          message: "At least one participant must be specified",
        },
        { status: 400 }
      )
    }

    // For DIRECT calls, ensure exactly 2 participants (initiator + 1 other)
    if (callType === "DIRECT" && participantIds.length !== 1) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_PARTICIPANTS",
          message: "Direct calls must have exactly one other participant",
        },
        { status: 400 }
      )
    }

    // Ensure initiator is in participant list
    if (!participantIds.includes(userId)) {
      participantIds.push(userId)
    }

    // Create call session
    const callSession = await chimeService.createCallSession({
      callType,
      conversationId: conversationId || null,
      initiatorId: userId,
      participantIds,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId: callSession.sessionId,
          chimeMeetingId: callSession.chimeMeetingId,
          participants: callSession.participants,
          timestamp: callSession.timestamp,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error initiating call:", error)

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
        message: "Failed to initiate call. Please try again later.",
      },
      { status: 500 }
    )
  }
}
