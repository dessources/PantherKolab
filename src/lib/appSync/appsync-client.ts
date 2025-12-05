/**
 * AWS AppSync Events Client
 *
 * Uses AWS Amplify's events module for real-time subscriptions.
 * This file should only contain client-side subscription logic.
 * Event publishing should be handled by the server-side client.
 */

"use client";

import { events } from "aws-amplify/api";
import { AppSyncEvent } from "@/types/appsync-events";

// ============================================================================
// Subscriptions (using Amplify events module)
// ============================================================================

/**
 * Subscribe to an AppSync Events channel using Amplify
 *
 * @example
 * const channel = await subscribeToChannel('/chats/conv-123', {
 *   onEvent: (event) => console.log('New message:', event),
 *   onError: (error) => console.error('Error:', error),
 * });
 *
 *  Later, to unsubscribe:
 * channel.close();
 */
export async function subscribeToChannel<T = unknown>(
  channelPath: string,
  callbacks: {
    onEvent: (event: AppSyncEvent<T>) => void;
    onError?: (error: Error) => void;
  }
): Promise<{ close: () => void }> {
  try {
    const channel = await events.connect(channelPath);

    // Subscribe to events on this channel
    channel.subscribe({
      next: (data) => {
        try {
          // Parse the event data
          const event =
            typeof data.event === "string"
              ? JSON.parse(data.event)
              : data.event;
          callbacks.onEvent(event as AppSyncEvent<T>);
        } catch (e) {
          console.error("[AppSync] Failed to parse event:", e);
          callbacks.onError?.(
            e instanceof Error ? e : new Error("Failed to parse event")
          );
        }
      },
      error: (error) => {
        console.error("[AppSync] Subscription error:", error);
        callbacks.onError?.(
          error instanceof Error ? error : new Error(String(error))
        );
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`[AppSync] Subscribed to ${channelPath}`);

    return {
      close: () => {
        channel.close();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        process.env.NODE_ENV !== "production" && console.log(`[AppSync] Unsubscribed from ${channelPath}`);
      },
    };
  } catch (error) {
    console.error("[AppSync] Failed to subscribe:", error);
    throw error;
  }
}

/**
 * Subscribe to multiple channels at once
 */
export async function subscribeToChannels<T = unknown>(
  channelPaths: string[],
  callbacks: {
    onEvent: (event: AppSyncEvent<T>, channel: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<{ close: () => void }> {
  const subscriptions = await Promise.all(
    channelPaths.map(async (path) => {
      return subscribeToChannel<T>(path, {
        onEvent: (event) => callbacks.onEvent(event, path),
        onError: callbacks.onError,
      });
    })
  );

  return {
    close: () => {
      subscriptions.forEach((sub) => sub.close());
    },
  };
}

// ============================================================================
// User-Centric Subscription Functions
// ============================================================================
// With user-centric channels, each user subscribes to their own channel
// instead of subscribing to each conversation. This reduces subscription
// management from 20-40+ channels to just 2 fixed channels:
// - /chats/{userId} for all message and typing events
// - /calls/{userId} for all call events

/**
 * Subscribe to ALL chat events for the current user (messages + typing)
 *
 * Messages and typing events from all conversations arrive on this single channel.
 * Filter by conversationId in the event data if needed.
 */
export async function subscribeToUserChats(
  userId: string,
  onEvent: (event: AppSyncEvent) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/chats/${userId}`, {
    onEvent,
    onError,
  });
}

/**
 * Subscribe to ALL call events for the current user
 *
 * Includes: INCOMING_CALL, CALL_RINGING, CALL_CONNECTED, CALL_REJECTED,
 * CALL_ENDED, CALL_CANCELLED, PARTICIPANT_LEFT, CALL_ERROR
 */
export async function subscribeToUserCalls(
  userId: string,
  onEvent: (event: AppSyncEvent) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/calls/${userId}`, {
    onEvent,
    onError,
  });
}

/**
 * Subscribe to ALL whiteboard events for the current user
 *
 * Includes: WHITEBOARD_UPDATED, PARTICIPANT_JOINED, PARTICIPANT_LEFT, etc.
 */
export async function subscribeToUserWhiteboards(
  userId: string,
  onEvent: (event: AppSyncEvent) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/whiteboards/${userId}`, {
    onEvent,
    onError,
  });
}

// Legacy aliases for backwards compatibility
export const subscribeToUserMessages = subscribeToUserChats;
export const subscribeToUserNotifications = subscribeToUserCalls;

// ============================================================================
// Export
// ============================================================================
const AppSyncClient = {
  // Core functions
  subscribeToChannel,
  subscribeToChannels,

  // User-centric subscriptions (new)
  subscribeToUserChats,
  subscribeToUserCalls,
  subscribeToUserWhiteboards,

  // Legacy aliases
  subscribeToUserMessages,
  subscribeToUserNotifications,
};
export default AppSyncClient;
