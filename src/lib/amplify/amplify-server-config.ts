import { type ResourcesConfig } from "aws-amplify";

export const authConfig: ResourcesConfig["Auth"] = {
  Cognito: {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    loginWith: {
      email: true,
    },
    signUpVerificationMethod: "code",
    userAttributes: {
      email: {
        required: true,
      },
      given_name: {
        required: true,
      },
      family_name: {
        required: false,
      },
    },
    passwordFormat: {
      minLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialCharacters: true,
    },
  },
};

export const apiConfig: ResourcesConfig["API"] = {
  Events: {
    endpoint: process.env.NEXT_PUBLIC_APPSYNC_HTTP_ENDPOINT!,
    region: "us-east-1",
    defaultAuthMode: "userPool", // Uses Cognito tokens automatically
  },
};
