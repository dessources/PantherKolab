import { NextRequest, NextResponse } from "next/server"
import { CreateMeetingInput, MeetingAccessType } from "@/types/database"
import { chimeService } from "@/services/chimeService"
import { authenticateRequest } from "@/utils/auth/cognitoVerifier"

/**
 * POST /api/meetings/create
 * Create a new scheduled meeting
 *
 * Auth: Required (must be logged in)
 * Body: CreateMeetingInput
 * Returns: Meeting object with meetingId
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
    let body: Partial<CreateMeetingInput>
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

    // Validate required fields
    const { title, scheduledTime, accessType } = body

    if (!title || !scheduledTime || !accessType) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_FIELDS",
          message: "Missing required fields: title, scheduledTime, accessType",
          required: ["title", "scheduledTime", "accessType"],
        },
        { status: 400 }
      )
    }

    // Validate accessType
    const validAccessTypes = ["PUBLIC", "RESTRICTED", "CONVERSATION"]
    if (!validAccessTypes.includes(accessType)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_ACCESS_TYPE",
          message: `accessType must be one of: ${validAccessTypes.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Validate scheduledTime is a valid ISO timestamp
    const scheduledTimeDate = new Date(scheduledTime as string)
    if (isNaN(scheduledTimeDate.getTime())) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "INVALID_TIMESTAMP",
          message: "scheduledTime must be a valid ISO 8601 timestamp",
        },
        { status: 400 }
      )
    }

    // Validate scheduled time is in the future
    if (scheduledTimeDate < new Date()) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "PAST_TIMESTAMP",
          message: "Meeting cannot be scheduled in the past",
        },
        { status: 400 }
      )
    }

    // Validate invitedUserIds if RESTRICTED access type
    if (accessType === "RESTRICTED" && (!body.invitedUserIds || body.invitedUserIds.length === 0)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          code: "MISSING_INVITES",
          message: "RESTRICTED meetings must have at least one invited user",
        },
        { status: 400 }
      )
    }

    // Create meeting input object
    const createMeetingInput: CreateMeetingInput = {
      title: title as string,
      description: body.description || undefined,
      creatorId: userId,
      scheduledTime: scheduledTime as string,
      accessType: accessType as MeetingAccessType,
      invitedUserIds: body.invitedUserIds || [],
      conversationId: body.conversationId || undefined,
      maxAttendees: body.maxAttendees || 100,
      settings: body.settings,
    }

    // Create meeting via service
    const meeting = await chimeService.createMeeting(createMeetingInput)

    return NextResponse.json(
      {
        success: true,
        data: meeting,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating meeting:", error)

    // Handle service-level errors
    if (error instanceof Error) {
      // Check if it's a quota or permission error from Chime
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

      if (error.message.includes("permission") || error.message.includes("Permission")) {
        return NextResponse.json(
          {
            error: "Forbidden",
            code: "INSUFFICIENT_PERMISSIONS",
            message: "Insufficient permissions to create meetings",
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        code: "INTERNAL_ERROR",
        message: "Failed to create meeting. Please try again later.",
      },
      { status: 500 }
    )
  }
}
