/**
 * AWS Chime SDK Connection Test Script
 *
 * Tests connection to AWS Chime SDK and verifies permissions
 *
 * Usage:
 *   tsx scripts/test-chime-connection.ts
 */

import { chimeClient } from "../src/lib/chime/chimeConfig";
import {
  CreateMeetingCommand,
  DeleteMeetingCommand,
  CreateAttendeeCommand,
} from "@aws-sdk/client-chime-sdk-meetings";

async function testChimeConnection() {
  console.log("🧪 Testing AWS Chime SDK Connection...\n");

  let testMeetingId: string | undefined;

  try {
    // Test 1: Create a test meeting
    console.log("📋 Test 1: Creating test meeting...");
    const createMeetingCommand = new CreateMeetingCommand({
      ClientRequestToken: `test-${Date.now()}`,
      MediaRegion: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
      ExternalMeetingId: `test-meeting-${Date.now()}`,
    });

    const meetingResponse = await chimeClient.send(createMeetingCommand);
    testMeetingId = meetingResponse.Meeting?.MeetingId;

    if (!testMeetingId) {
      throw new Error("Meeting ID not returned");
    }

    console.log("   ✅ Meeting created successfully!");
    console.log(`   Meeting ID: ${testMeetingId}`);
    console.log(`   Media Region: ${meetingResponse.Meeting?.MediaRegion}`);
    console.log(
      `   External ID: ${meetingResponse.Meeting?.ExternalMeetingId}\n`
    );

    // Test 2: Create an attendee
    console.log("📋 Test 2: Creating test attendee...");
    const createAttendeeCommand = new CreateAttendeeCommand({
      MeetingId: testMeetingId,
      ExternalUserId: "test-user-123",
    });

    const attendeeResponse = await chimeClient.send(createAttendeeCommand);

    console.log("   ✅ Attendee created successfully!");
    console.log(`   Attendee ID: ${attendeeResponse.Attendee?.AttendeeId}`);
    console.log(
      `   External User ID: ${attendeeResponse.Attendee?.ExternalUserId}\n`
    );

    // Test 3: Clean up - Delete the meeting
    console.log("📋 Test 3: Cleaning up test meeting...");
    const deleteMeetingCommand = new DeleteMeetingCommand({
      MeetingId: testMeetingId,
    });

    await chimeClient.send(deleteMeetingCommand);
    console.log("   ✅ Meeting deleted successfully!\n");

    // Success summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ All Chime SDK tests passed!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nYour Chime SDK is configured correctly!");
    console.log("You can now proceed with implementing video/audio calls.\n");

    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ Chime SDK Connection Test Failed");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("\n");

    // Provide helpful troubleshooting tips
    if (
      error.name === "UnrecognizedClientException" ||
      error.name === "InvalidClientTokenId"
    ) {
      console.error("🔍 Troubleshooting:");
      console.error("   → Check your AWS_ACCESS_KEY_ID in .env.local");
      console.error("   → Check your AWS_SECRET_ACCESS_KEY in .env.local");
      console.error("   → Ensure credentials are valid and active\n");
    } else if (error.name === "AccessDeniedException") {
      console.error("🔍 Troubleshooting:");
      console.error("   → Your AWS credentials are valid but lack permissions");
      console.error("   → Add these IAM permissions to your user/role:");
      console.error("      - chime:CreateMeeting");
      console.error("      - chime:DeleteMeeting");
      console.error("      - chime:CreateAttendee");
      console.error("      - chime:GetMeeting");
      console.error(
        '   → Consider attaching the "AmazonChimeSDK" managed policy\n'
      );
    } else if (error.name === "InvalidParameterException") {
      console.error("🔍 Troubleshooting:");
      console.error("   → Check that NEXT_PUBLIC_AWS_REGION is set correctly");
      console.error(
        "   → Ensure the region supports Chime SDK (us-east-1, us-west-2, etc.)\n"
      );
    } else {
      console.error("🔍 Troubleshooting:");
      console.error("   → Check your internet connection");
      console.error(
        "   → Verify AWS service status at https://status.aws.amazon.com/"
      );
      console.error("   → Review full error details above\n");
    }

    // Attempt cleanup if meeting was created
    if (testMeetingId) {
      try {
        console.log("🧹 Attempting to clean up test meeting...");
        const cleanupCommand = new DeleteMeetingCommand({
          MeetingId: testMeetingId,
        });
        await chimeClient.send(cleanupCommand);
        console.log("   ✅ Test meeting cleaned up\n");
      } catch {
        console.log(
          "   ⚠️  Could not clean up test meeting (may require manual deletion)\n"
        );
      }
    }

    return false;
  }
}

// Run the test
testChimeConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
