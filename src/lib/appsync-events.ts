/* eslint-disable import/no-anonymous-default-export */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AWS AppSync Event API Publisher
 *
 * This module provides functionality to publish events to AWS AppSync Event API.
 * Events are published via HTTP POST and broadcasted to all subscribed servers.
 *
 * Usage:
 *   await publishEvent({
 *     channel: '/conversations/conv-123',
 *     event: {
 *       type: 'MESSAGE_SENT',
 *       data: messageObject
 *     }
 *   });
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Event types for real-time messaging
 */
export type EventType =
  | "MESSAGE_SENT"
  | "MESSAGE_DELETED"
  | "MESSAGE_UPDATED"
  | "MESSAGE_READ"
  | "USER_TYPING"
  | "USER_STOPPED_TYPING"
  | "CONVERSATION_CREATED"
  | "CONVERSATION_UPDATED"
  | "USER_JOINED"
  | "USER_LEFT";

/**
 * Event payload structure
 */
export interface AppSyncEvent<T = any> {
  type: EventType;
  data: T;
  timestamp?: string;
}

/**
 * Publish event input
 */
export interface PublishEventInput<T = any> {
  channel: string;
  event: AppSyncEvent<T>;
}

/**
 * AppSync API response
 */
interface AppSyncResponse {
  success?: boolean;
  errors?: Array<{
    message: string;
    errorType?: string;
  }>;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

const REQUEST_TIMEOUT = 5000; // 5 seconds

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * Get AppSync HTTP endpoint from environment
 */
function getAppSyncEndpoint(): string {
  const endpoint = process.env.NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      "Missing NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT environment variable. " +
        "Please run ./scripts/fetch-parameters.sh to fetch from Parameter Store."
    );
  }

  // Validate endpoint format
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    console.warn(
      '[AppSync] Warning: Endpoint should start with https:// ' +
      `Current value: ${endpoint}`
    );
  }

  if (!endpoint.includes('/event')) {
    console.warn(
      '[AppSync] Warning: HTTP endpoint should end with /event for publishing. ' +
      `Current endpoint: ${endpoint}`
    );
  }

  return endpoint;
}

/**
 * Get AppSync API key from environment (if using API key auth)
 */
function getAppSyncApiKey(): string | undefined {
  const apiKey = process.env.APPSYNC_EVENT_API_KEY;
  
  // Add validation and helpful error messages
  if (apiKey && !apiKey.startsWith('da2-')) {
    console.warn(
      '[AppSync] Warning: API key does not start with "da2-". ' +
      'Make sure you are using the API Key, not the API ID.'
    );
  }
  
  return apiKey;
}

/**
 * Get AWS credentials from environment (if using IAM auth)
 */
function getAwsCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  return undefined;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate channel format
 * Channels should follow the pattern: /namespace/identifier
 * Example: /conversations/conv-123
 */
function validateChannel(channel: string): void {
  if (!channel.startsWith("/")) {
    throw new Error(
      `Invalid channel format: "${channel}". Channel must start with "/"`
    );
  }

  const parts = channel.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid channel format: "${channel}". ` +
        `Expected format: /namespace/identifier (e.g., /conversations/conv-123)`
    );
  }
}

/**
 * Create request headers for AppSync
 */
function createHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Try API key authentication first
  const apiKey = getAppSyncApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    console.log('[AppSync] Using API Key authentication (key prefix:', apiKey.substring(0, 8) + '...)');
    return headers;
  }

  // If no API key, check for AWS credentials
  const credentials = getAwsCredentials();
  if (credentials) {
    console.log('[AppSync] AWS credentials found, but IAM signing not yet implemented');
    console.log('[AppSync] Note: IAM authentication requires additional implementation');
  } else {
    console.warn(
      '[AppSync] No authentication configured! ' +
      'Set APPSYNC_EVENT_API_KEY for API key auth or AWS credentials for IAM auth.'
    );
  }

  return headers;
}

// ============================================================================
// Core Publishing Logic
// ============================================================================

/**
 * Make HTTP request to AppSync with timeout
 */
async function makeAppSyncRequest(
  endpoint: string,
  body: string,
  headers: HeadersInit
): Promise<AppSyncResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data = await response.json();

    // Check for errors
    if (!response.ok) {
      throw new Error(
        `AppSync request failed with status ${
          response.status
        }: ${JSON.stringify(data)}`
      );
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AppSync request timed out after ${REQUEST_TIMEOUT}ms`);
    }

    throw error;
  }
}

/**
 * Publish event with retry logic
 */
async function publishWithRetry<T>(
  input: PublishEventInput<T>,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<void> {
  const endpoint = getAppSyncEndpoint();
  const headers = createHeaders();

  // Add timestamp if not provided
  if (!input.event.timestamp) {
    input.event.timestamp = new Date().toISOString();
  }

  // Prepare request body: wrap the event in an array
  // CRITICAL: Events must be stringified JSON values, not plain objects
  // See: https://docs.aws.amazon.com/appsync/latest/eventapi/publish-http.html
  const requestBody = JSON.stringify({
    channel: input.channel,
    events: [JSON.stringify(input.event)],
  });

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `[AppSync] Retry attempt ${attempt}/${retryConfig.maxRetries} for channel ${input.channel}`
        );
      }

      const response = await makeAppSyncRequest(endpoint, requestBody, headers);

      if (response.errors && response.errors.length > 0) {
        throw new Error(
          `AppSync returned errors: ${response.errors.map((e) => e.message).join(", ")}`
        );
      }

      console.log(
        `[AppSync] Successfully published event "${input.event.type}" to channel ${input.channel}`
      );
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[AppSync] Attempt ${attempt + 1} failed for channel ${input.channel}:`,
        lastError.message
      );

      if (attempt === retryConfig.maxRetries) break;

      const delay = calculateBackoff(attempt, retryConfig);
      console.log(`[AppSync] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  throw new Error(
    `Failed to publish event to AppSync after ${retryConfig.maxRetries + 1} attempts. Last error: ${lastError?.message}`
  );
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Publish an event to AppSync Event API
 *
 * @param input - Event input with channel and event data
 * @returns Promise that resolves when event is published
 *
 * @example
 * ```typescript
 * await publishEvent({
 *   channel: '/conversations/conv-123',
 *   event: {
 *     type: 'MESSAGE_SENT',
 *     data: {
 *       messageId: 'msg-456',
 *       content: 'Hello World',
 *       senderId: 'user-789'
 *     }
 *   }
 * });
 * ```
 */
export async function publishEvent<T = any>(
  input: PublishEventInput<T>
): Promise<void> {
  // Validate input
  validateChannel(input.channel);

  if (!input.event.type) {
    throw new Error("Event type is required");
  }

  // Publish with retry
  await publishWithRetry(input);
}

/**
 * Batch publish multiple events to the same channel
 * This is more efficient than calling publishEvent multiple times
 *
 * @param channel - The channel to publish to
 * @param events - Array of events to publish
 * @returns Promise that resolves when all events are published
 *
 * @example
 * ```typescript
 * await batchPublishEvents('/conversations/conv-123', [
 *   { type: 'MESSAGE_SENT', data: message1 },
 *   { type: 'MESSAGE_SENT', data: message2 },
 * ]);
 * ```
 */
export async function batchPublishEvents<T = any>(
  channel: string,
  events: Array<AppSyncEvent<T>>
): Promise<void> {
  validateChannel(channel);

  if (events.length === 0) {
    throw new Error("At least one event is required");
  }

  const endpoint = getAppSyncEndpoint();
  const headers = createHeaders();

  // Add timestamps
  const eventsWithTimestamp = events.map((event) => ({
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  }));

  // Prepare request body: stringify each event
  // CRITICAL: Events must be stringified JSON values, not plain objects
  const requestBody = JSON.stringify({
    channel,
    events: eventsWithTimestamp.map((event) => JSON.stringify(event)),
  });

  // Publish with retry
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= DEFAULT_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await makeAppSyncRequest(endpoint, requestBody, headers);

      if (response.errors && response.errors.length > 0) {
        throw new Error(
          `AppSync returned errors: ${response.errors
            .map((e) => e.message)
            .join(", ")}`
        );
      }

      console.log(
        `[AppSync] Successfully published ${events.length} events to channel ${channel}`
      );
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === DEFAULT_RETRY_CONFIG.maxRetries) {
        break;
      }

      const delay = calculateBackoff(attempt, DEFAULT_RETRY_CONFIG);
      await sleep(delay);
    }
  }

  throw new Error(
    `Failed to batch publish events to AppSync after ${
      DEFAULT_RETRY_CONFIG.maxRetries + 1
    } attempts. ` + `Last error: ${lastError?.message}`
  );
}

/**
 * Test AppSync connectivity
 * Useful for debugging and health checks
 *
 * @returns Promise that resolves to true if AppSync is reachable
 */
export async function testAppSyncConnection(): Promise<boolean> {
  try {
    await publishEvent({
      channel: "/conversations/test",
      event: {
        type: "MESSAGE_SENT",
        data: { message: "Test from next.js api route" },
      },
    });
    return true;
  } catch (error) {
    console.error("[AppSync] Health check failed:", error);
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  publishEvent,
  batchPublishEvents,
  testAppSyncConnection,
};