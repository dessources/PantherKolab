import { ChimeSDKMeetingsClient } from "@aws-sdk/client-chime-sdk-meetings";
import { parameterStore } from "@/lib/parameterStore";
import { CHIME_MAX_ATTENDEES } from "@/utils";

export async function getChimeMaxAttendees(): Promise<number> {
  const value = await parameterStore.getParameter("chime/max-attendees");
  return parseInt(value, 10);
}

export const chimeClient = new ChimeSDKMeetingsClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Synchronous config with default value (for app initialization)
export const CHIME_CONFIG = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  maxAttendees: CHIME_MAX_ATTENDEES,
  meetingFeatures: {
    audio: {
      echoReduction: true,
    },
  },
};

export interface ChimeConfigType {
  region: string;
  maxAttendees: number;
  meetingFeatures: {
    audio: {
      echoReduction: boolean;
    };
  };
}

/**
 * Get Chime configuration with live Parameter Store values
 * Use this in API routes and scripts to fetch fresh config from Parameter Store
 * @example
 * const config = await getChimeConfig();
 * console.log(config.maxAttendees); // Fetched from Parameter Store
 */
export async function getChimeConfig(): Promise<ChimeConfigType> {
  return {
    region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
    maxAttendees: await getChimeMaxAttendees(),
    meetingFeatures: {
      audio: {
        echoReduction: true,
      },
    },
  };
}
