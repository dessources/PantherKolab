/**
 * AWS AppSync Events Client (Server-Side)
 *
 * For publishing events from Next.js API routes using Cognito token authentication.
 */

import { AppSyncEvent } from "@/types/appsync-events";

// HTTP endpoint for server-side publishing
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_HTTP_ENDPOINT!;

/**
 * Publish an event to a channel from the server-side.
 *
 * @param channel The channel to publish to (e.g., '/chats/user-123')
 * @param event The event object to publish
 * @param authToken A valid Cognito ID token for authorization
 */
export async function publishEvent(
  channel: string,
  event: AppSyncEvent,
  authToken: string
): Promise<void> {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  const response = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken,
    },
    body: JSON.stringify({
      channel,
      events: [JSON.stringify(eventWithTimestamp)],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[AppSync] Publish failed: ${response.status} - ${errorBody}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  process.env.NODE_ENV !== "production" && console.log(`[AppSync] Server published ${event.type} to ${channel}`);
}

/**
 * Publish multiple events to a channel in a single request.
 *
 * @param channel The channel to publish to
 * @param eventList An array of event objects
 * @param authToken A valid Cognito ID token for authorization
 */
export async function batchPublish(
  channel: string,
  eventList: AppSyncEvent[],
  authToken: string
): Promise<void> {
  const eventsWithTimestamp = eventList.map((event) =>
    JSON.stringify({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    })
  );

  const response = await fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken,
    },
    body: JSON.stringify({
      channel,
      events: eventsWithTimestamp,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[AppSync] Batch publish failed: ${response.status} - ${errorBody}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  process.env.NODE_ENV !== "production" && console.log(
    `[AppSync] Server batch published ${eventList.length} events to ${channel}`
  );
}

/**
 * Publish an event to multiple user-specific channels.
 *
 * @param userIds An array of user IDs
 * @param channelPrefix The prefix for the user channel (e.g., '/chats')
 * @param event The event object to publish
 * @param authToken A valid Cognito ID token for authorization
 */
export async function publishToUsers(
  userIds: string[],
  channelPrefix: string,
  event: AppSyncEvent,
  authToken: string
): Promise<void> {
  // This will run requests in parallel
  await Promise.all(
    userIds.map((userId) => {
      const userChannel = `${channelPrefix}/${userId}`;
      return publishEvent(userChannel, event, authToken);
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  process.env.NODE_ENV !== "production" && console.log(
    `[AppSync] Published ${event.type} to ${userIds.length} user channels via server`
  );
}
