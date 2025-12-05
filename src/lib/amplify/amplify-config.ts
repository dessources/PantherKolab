/* eslint-disable @typescript-eslint/no-unused-expressions */
"use client";

import { Amplify } from "aws-amplify";
import { useEffect } from "react";
import { authConfig, apiConfig } from "./amplify-server-config";

// Configure immediately on module load
if (typeof window !== "undefined") {
  process.env.NODE_ENV !== "production" &&
    console.log("User Pool ID:", process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID);

  process.env.NODE_ENV !== "production" &&
    console.log("Client ID:", process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID);

  Amplify.configure(
    {
      Auth: authConfig,
      API: apiConfig,
    },
    {
      ssr: true,
    }
  );

  process.env.NODE_ENV !== "production" && console.log("✅ Amplify configured");
}

export function ConfigureAmplifyClientSide() {
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
      !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    ) {
      process.env.NODE_ENV !== "production" &&
        console.error("❌ Missing environment variables!");
      return;
    }

    Amplify.configure(
      {
        Auth: authConfig,
        API: apiConfig,
      },
      {
        ssr: true,
      }
    );
  }, []);

  return null;
}

export default Amplify;
