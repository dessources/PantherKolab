import { ChimeSDKMeetingsClient } from "@aws-sdk/client-chime-sdk-meetings";

import { CHIME_MAX_ATTENDEES } from "@/utils";

export const chimeClient = new ChimeSDKMeetingsClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const CHIME_CONFIG = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  maxAttendees: CHIME_MAX_ATTENDEES,
  meetingFeatures: {
    audio: {
      echoReduction: true,
    },
  },
};
