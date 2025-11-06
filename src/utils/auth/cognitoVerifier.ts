import { CognitoJwtVerifier } from "aws-jwt-verify";
import { NextResponse } from "next/server";
import { parameterStore } from "@/lib/parameterStore";

/**
 * Singleton Cognito JWT Verifier instance
 * Used to verify ID tokens from AWS Cognito
 * Initialized lazily on first use
 */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
let verifierPromise: Promise<
  ReturnType<typeof CognitoJwtVerifier.create>
> | null = null;

/**
 * Initialize and return the Cognito JWT verifier
 * Fetches Cognito configuration from Parameter Store
 * Uses singleton pattern to avoid repeated initialization
 */
async function getVerifier(): Promise<
  ReturnType<typeof CognitoJwtVerifier.create>
> {
  // Return cached verifier if already initialized
  if (verifier) {
    return verifier;
  }

  // Return pending promise if initialization is in progress
  if (verifierPromise) {
    return verifierPromise;
  }

  // Initialize verifier
  verifierPromise = (async () => {
    try {
      // Fetch Cognito configuration from Parameter Store
      const config = await parameterStore.getParameters([
        "cognito/user-pool-id",
        "cognito/client-id",
      ]);

      const userPoolId = config["cognito/user-pool-id"];
      const clientId = config["cognito/client-id"];

      if (!userPoolId || !clientId) {
        throw new Error(
          "Missing required Cognito parameters in Parameter Store: cognito/user-pool-id and cognito/client-id"
        );
      }

      verifier = CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: "id",
      });

      return verifier;
    } catch (error) {
      // Reset promise on error to allow retry on next call
      verifierPromise = null;
      throw error;
    }
  })();

  return verifierPromise;
}

/**
 * Error class for token verification failures
 */
export class TokenVerificationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "TokenVerificationError";
  }
}

/**
 * Verify a JWT token and extract the user ID
 *
 * @param token - The JWT token to verify (without "Bearer " prefix)
 * @returns Object containing userId extracted from token
 * @throws TokenVerificationError if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<{ userId: string }> {
  if (!token) {
    throw new TokenVerificationError("No token provided", "NO_TOKEN");
  }

  try {
    const verifier_ = await getVerifier();
    const payload = await verifier_.verify(token);
    const userId = payload.sub;

    if (!userId) {
      throw new TokenVerificationError(
        "Token missing user ID (sub)",
        "INVALID_TOKEN"
      );
    }

    return { userId };
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error instanceof TokenVerificationError) {
      throw error;
    }

    // Handle Cognito JWT verification errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("expired") || message.includes("expiration")) {
        throw new TokenVerificationError("Token has expired", "TOKEN_EXPIRED");
      }

      if (message.includes("invalid") || message.includes("malformed")) {
        throw new TokenVerificationError(
          "Invalid or malformed token",
          "INVALID_TOKEN"
        );
      }

      if (message.includes("signature")) {
        throw new TokenVerificationError(
          "Token signature verification failed",
          "SIGNATURE_INVALID"
        );
      }

      // Generic verification error
      throw new TokenVerificationError(
        "Token verification failed: " + error.message,
        "VERIFICATION_FAILED"
      );
    }

    throw new TokenVerificationError(
      "Unknown token verification error",
      "UNKNOWN_ERROR"
    );
  }
}

/**
 * Extract bearer token from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The token without "Bearer " prefix
 * @throws TokenVerificationError if header is missing or invalid format
 */
export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader) {
    throw new TokenVerificationError(
      "Authorization header is required",
      "NO_AUTH_HEADER"
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new TokenVerificationError(
      "Authorization header must be in format: Bearer <token>",
      "INVALID_AUTH_FORMAT"
    );
  }

  return authHeader.substring(7);
}

/**
 * Authenticate a request and extract user ID
 * This is a convenience function that combines token extraction and verification
 * and returns a NextResponse error if authentication fails
 *
 * @param authHeader - The Authorization header value from the request
 * @returns Object containing userId on success
 * @returns NextResponse with 401 error on authentication failure
 *
 * @example
 * const authResult = await authenticateRequest(req.headers.get("authorization"))
 * if (authResult instanceof NextResponse) {
 *   return authResult // Return error response
 * }
 * const { userId } = authResult
 */
export async function authenticateRequest(
  authHeader: string | null
): Promise<{ userId: string } | NextResponse> {
  try {
    // Extract bearer token
    const token = extractBearerToken(authHeader);

    // Verify token and get userId
    const result = await verifyToken(token);
    return result;
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: error.code,
          message: error.message,
        },
        { status: 401 }
      );
    }

    // Re-throw unexpected errors to be caught by route handler
    throw error;
  }
}
