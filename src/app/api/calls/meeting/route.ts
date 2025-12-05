import { NextRequest, NextResponse } from "next/server";
import { ChimeSDKMeetings } from "@aws-sdk/client-chime-sdk-meetings";
import { callService } from "@/services/callService";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";

// Initialize AWS Chime SDK Meetings client
const chime = new ChimeSDKMeetings({
  region: process.env.AWS_CHIME_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate a unique client ID for tracking
 */
function generateClientId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * POST /api/calls/meeting
 * Actions:
 * - CREATE_MEETING: Create a new Chime meeting
 * - JOIN_MEETING: Join an existing Chime meeting
 * - END_MEETING: Delete a Chime meeting
 * - LEAVE_MEETING: Remove attendee from meeting
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      action,
      sessionId,
      userId: bodyUserId,
      userName,
      meetingId,
      attendeeId,
    } = body;
    const clientId = req.headers.get("x-client-id") || generateClientId();

    // Verify the userId matches the authenticated user (if provided in body)
    if (!verifyUserMatch(bodyUserId, auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: Cannot perform meeting actions as another user" },
        { status: 403 }
      );
    }

    switch (action) {
      case "CREATE_MEETING": {
        // Validate required fields
        if (!sessionId) {
          return NextResponse.json(
            { error: "Missing required field: sessionId" },
            { status: 400 }
          );
        }

        // Get call record
        const call = await callService.getCall(sessionId);
        if (!call) {
          return NextResponse.json(
            { error: "Call not found" },
            { status: 404 }
          );
        }

        // Create Chime meeting
        const meeting = await chime.createMeeting({
          ClientRequestToken: sessionId, // Use sessionId as idempotency token
          MediaRegion: process.env.AWS_CHIME_REGION || "us-east-1",
          ExternalMeetingId: sessionId,
        });

        if (!meeting.Meeting?.MeetingId) {
          throw new Error("Failed to create Chime meeting");
        }

        // Update call with Chime meeting ID
        await callService.updateChimeMeetingId(
          sessionId,
          meeting.Meeting.MeetingId
        );

        // Create attendee for the creator (use authenticated userId)
        const attendee = await chime.createAttendee({
          MeetingId: meeting.Meeting.MeetingId,
          ExternalUserId: `${userName || auth.userId}#${clientId}`,
        });

        // Update participant status
        await callService.updateParticipantStatus(
          sessionId,
          auth.userId,
          "JOINED",
          attendee.Attendee?.AttendeeId
        );

        // Update call status to ACTIVE
        await callService.updateCallStatus(sessionId, "ACTIVE");

        return NextResponse.json({
          success: true,
          meeting: meeting.Meeting,
          attendee: attendee.Attendee,
        });
      }

      case "JOIN_MEETING": {
        // Validate required fields
        if (!sessionId) {
          return NextResponse.json(
            { error: "Missing required field: sessionId" },
            { status: 400 }
          );
        }

        // Get call record
        const call = await callService.getCall(sessionId);
        if (!call) {
          return NextResponse.json(
            { error: "Call not found" },
            { status: 404 }
          );
        }

        if (!call.chimeMeetingId) {
          return NextResponse.json(
            { error: "Meeting not yet created" },
            { status: 400 }
          );
        }

        // Get existing Chime meeting
        let meeting;
        try {
          meeting = await chime.getMeeting({
            MeetingId: call.chimeMeetingId,
          });
        } catch (error) {
          console.error("Failed to get meeting:", error);
          return NextResponse.json(
            { error: "Meeting not found or has ended" },
            { status: 404 }
          );
        }

        // Create attendee (use authenticated userId)
        const attendee = await chime.createAttendee({
          MeetingId: call.chimeMeetingId,
          ExternalUserId: `${userName || auth.userId}#${clientId}`,
        });

        // Update participant status
        await callService.updateParticipantStatus(
          sessionId,
          auth.userId,
          "JOINED",
          attendee.Attendee?.AttendeeId
        );

        return NextResponse.json({
          success: true,
          meeting: meeting.Meeting,
          attendee: attendee.Attendee,
        });
      }

      case "LEAVE_MEETING": {
        // Validate required fields
        if (!meetingId || !attendeeId) {
          return NextResponse.json(
            { error: "Missing required fields: meetingId, attendeeId" },
            { status: 400 }
          );
        }

        // Delete attendee from Chime meeting
        await chime.deleteAttendee({
          MeetingId: meetingId,
          AttendeeId: attendeeId,
        });

        // Update participant status (use authenticated userId)
        if (sessionId) {
          await callService.updateParticipantStatus(
            sessionId,
            auth.userId,
            "LEFT"
          );
        }

        return NextResponse.json({ success: true });
      }

      case "END_MEETING": {
        // Validate required fields
        if (!sessionId) {
          return NextResponse.json(
            { error: "Missing required field: sessionId" },
            { status: 400 }
          );
        }

        // Get call record
        const call = await callService.getCall(sessionId);
        if (!call) {
          return NextResponse.json(
            { error: "Call not found" },
            { status: 404 }
          );
        }

        if (call.chimeMeetingId) {
          // Delete Chime meeting
          await chime.deleteMeeting({
            MeetingId: call.chimeMeetingId,
          });
        }

        // Update call status
        await callService.endCall(sessionId);

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Chime API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
