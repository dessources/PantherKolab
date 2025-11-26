# Socket.IO to AWS AppSync Events Migration Guide

This guide provides step-by-step instructions to migrate PantherKolab from Socket.IO to AWS AppSync Events, enabling serverless deployment on Vercel.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [Phase 1: AWS AppSync Events Setup](#phase-1-aws-appsync-events-setup)
4. [Phase 2: Create AppSync Client](#phase-2-create-appsync-client)
5. [Phase 3: Migrate Messaging](#phase-3-migrate-messaging)
6. [Phase 4: Migrate Call Signaling](#phase-4-migrate-call-signaling)
7. [Phase 5: Remove Socket.IO](#phase-5-remove-socketio)
8. [Phase 6: Deploy to Vercel](#phase-6-deploy-to-vercel)
9. [Testing Checklist](#testing-checklist)
10. [Rollback Plan](#rollback-plan)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### Why Migrate?

| Aspect                 | Socket.IO (Current)        | AppSync Events (Target)           |
| ---------------------- | -------------------------- | --------------------------------- |
| **Hosting Cost**       | ~$3-10/month (EC2)         | ~$0/month (Vercel free tier)      |
| **Infrastructure**     | Custom server.ts required  | Serverless (no server management) |
| **Scaling**            | Manual (PM2, clustering)   | Automatic (AWS managed)           |
| **Maintenance**        | Nginx, SSL, PM2 monitoring | Zero maintenance                  |
| **Latency**            | ~10-50ms                   | ~50-150ms                         |
| **Presence Detection** | Built-in (socket rooms)    | Requires custom implementation    |

### What Changes

**Removed:**

- Custom `server.ts` with Socket.IO
- WebSocket connections managed by our server
- Room-based presence detection

**Added:**

- AWS AppSync Events API (managed WebSockets)
- Next.js API routes for all mutations
- AppSync subscriptions for real-time updates

### Prerequisites

- AWS Account with AppSync access
- Existing Cognito User Pool (already configured)
- Vercel account (free tier works)
- Node.js 20+

---

## Architecture Comparison

### Current Architecture (Socket.IO)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
│                   (React + Socket.IO)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Custom server.ts                              │
│              (Next.js + Socket.IO Server)                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ messageSocket.ts│  │ callSocket.ts   │  │ socketAuth.ts   │  │
│  │                 │  │                 │  │                 │  │
│  │ • send-message  │  │ • new-call      │  │ • JWT verify    │  │
│  │ • typing-start  │  │ • accept-call   │  │ • userId attach │  │
│  │ • typing-stop   │  │ • reject-call   │  │                 │  │
│  │                 │  │ • end-call      │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │       DynamoDB         │
              │   + AWS Chime SDK      │
              └────────────────────────┘
```

### Target Architecture (AppSync Events)

This migration uses a **user-centric subscription model** where each user subscribes to their own channel (`/chats/{userId}`) instead of subscribing to each conversation. This simplifies client code and reduces subscription management overhead.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
│                  (React + AppSync Client)                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Cognito JWT Token (for auth on both AppSync and API routes) ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Subscriptions (only 2-3 per user):                             │
│  • /chats/{currentUserId}   ← Messages + typing indicators      │
│  • /users/{currentUserId}   ← Incoming calls, notifications     │
│  • /calls/{sessionId}       ← Active call events (when in call) │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               │ Subscribe (WebSocket)      │ Mutations (HTTP)
               ▼                            ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│   AppSync Events API     │    │     Vercel API Routes          │
│   (Real-time broadcast)  │    │     (Serverless Functions)     │
│                          │    │                                │
│  User-Centric Channels:  │    │  /api/messages/send            │
│  • /chats/{userId}       │    │    → Publishes to ALL          │
│  • /users/{userId}       │    │      participant channels      │
│  • /calls/{sessionId}    │    │  /api/calls/initiate           │
│                          │    │  /api/calls/accept             │
│                          │    │  /api/calls/reject             │
│  onPublish: Add timestamp│    │  /api/calls/end                │
└──────────────────────────┘    │                                │
                                │  → DynamoDB + Chime SDK        │
                                │  → Publish to AppSync          │
                                └────────────────────────────────┘
```

#### User-Centric vs Per-Conversation Model

| Aspect                      | Per-Conversation              | User-Centric (Chosen)     |
| --------------------------- | ----------------------------- | ------------------------- |
| **Subscriptions per user**  | 20-40+ (one per chat)         | 2-3 (fixed)               |
| **Reconnection time**       | Slow (resubscribe to all)     | Fast (only 2-3 channels)  |
| **Client complexity**       | High (dynamic sub management) | Low (fixed subscriptions) |
| **Publishes per message**   | 1                             | N (one per participant)   |
| **Cost per message**        | Lower                         | ~6x higher                |
| **Monthly cost (1K users)** | \\$0.50                       | 3.00                      |

**Why user-centric?** The simpler client code and faster reconnection outweigh the marginal cost increase. At typical usage levels, both approaches cost pennies.

---

## Phase 1: AWS AppSync Events Setup

### Step 1.1: Create Event API

1. **Navigate to AppSync Console:**

   - AWS Console → AppSync → **Create API**
   - Select **Event API** (not GraphQL API)

2. **Configure API:**

   - **Name:** `PantherKolab-Events`
   - **Authorization mode:** Amazon Cognito User Pool
     - User Pool ID: `us-east-1_4fWvgNvC3` (your existing pool)
     - Default action: **ALLOW**
     - App client ID: Leave blank (uses all clients)

3. **Create API** and note:
   - **HTTP Endpoint:** `https://xxx.appsync-api.us-east-1.amazonaws.com/event`
   - **Realtime Endpoint:** `wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime`
   - **API ID:** (for reference only)

### Step 1.2: Create Namespaces

In the AppSync Events console, create these namespaces:

| Namespace   | Purpose                          | Auth    | Notes                                          |
| ----------- | -------------------------------- | ------- | ---------------------------------------------- |
| `/chats/*`  | Messages + typing indicators     | Cognito | Each user subscribes to `/chats/{theirUserId}` |
| `/users/*`  | Direct notifications (calls)     | Cognito | Incoming calls, call status updates            |
| `/calls/*`  | Active call session events       | Cognito | Subscribed only during active call             |

**Important:** With user-centric channels, messages are published to each participant's channel. For a 2-person chat, the server publishes to 2 channels. For a 10-person group, the server publishes to 10 channels.

### Step 1.3: Configure onPublish Handlers

For each namespace, add an **onPublish** handler to inject server timestamp:

**Go to:** AppSync → Your API → Event Handlers → onPublish

```javascript
// onPublish handler for all namespaces
export function onPublish(ctx) {
  const now = util.time.nowISO8601();

  ctx.events.forEach((event) => {
    // Parse the stringified event
    const parsed = JSON.parse(event);

    // Add server timestamp
    parsed.serverTimestamp = now;

    // Return modified event
    event = JSON.stringify(parsed);
  });

  return ctx.events;
}
```

### Step 1.3.1: Alternative - DynamoDB Persistence via onPublish Handler

> **Note:** This is an OPTIONAL alternative approach. The recommended approach is to persist messages in the Next.js API route (Phase 3), which provides synchronous confirmation that messages are saved before broadcasting.

If you prefer to have AppSync handle message persistence directly (reducing API route complexity), you can modify the onPublish handler to write to DynamoDB using AppSync's built-in DynamoDB utilities.

**Trade-offs:**

| Aspect                   | API Route (Recommended)              | onPublish Handler (Alternative)      |
| ------------------------ | ------------------------------------ | ------------------------------------ |
| Persistence confirmation | Synchronous (before broadcast)       | Asynchronous (after broadcast)       |
| Error handling           | Direct feedback to client            | Silent failures (requires monitoring)|
| API route complexity     | Higher (DynamoDB + AppSync publish)  | Lower (AppSync only)                 |
| Debugging                | Easier (single location)             | Harder (check CloudWatch logs)       |
| Data consistency         | Guaranteed (save then broadcast)     | Eventual (broadcast then save)       |

#### Setup Requirements

1. **Create a DynamoDB Data Source in AppSync:**
   - Go to AppSync Console → Your API → Data Sources
   - Click "Create Data Source"
   - Name: `MessagesTable`
   - Type: Amazon DynamoDB
   - Table: `PantherKolab-Messages` (your messages table)
   - Create or use an existing IAM role with DynamoDB write permissions

2. **IAM Role Permissions:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:PutItem",
           "dynamodb:UpdateItem"
         ],
         "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/PantherKolab-Messages"
       }
     ]
   }
   ```

3. **Attach the data source to your onPublish handler** in the AppSync console.

#### onPublish Handler with DynamoDB Persistence

```javascript
// onPublish handler that persists MESSAGE_SENT events to DynamoDB
// Uses AppSync's built-in DynamoDB utilities
import * as ddb from '@aws-appsync/utils/dynamodb'

export const onPublish = {
  request(ctx) {
    // Get the first event from the batch
    const event = ctx.events[0]

    // Parse the stringified event (AppSync Events require stringified payloads)
    const payload = typeof event === 'string' ? JSON.parse(event) : event

    // Only persist MESSAGE_SENT events to DynamoDB
    // Typing indicators, read receipts, etc. don't need persistence
    if (payload.type !== 'MESSAGE_SENT') {
      // Return null to skip DynamoDB operation, event is still forwarded
      return null
    }

    const message = payload.data
    const now = util.time.nowISO8601()

    // Build the DynamoDB item matching existing table schema
    // See src/services/messageService.ts for field definitions
    const item = {
      // Primary key
      conversationId: message.conversationId,
      timestamp: message.timestamp || now,

      // Message fields
      messageId: message.messageId,
      senderId: message.senderId,
      type: message.type || 'TEXT',
      content: message.content,

      // Optional media fields
      mediaUrl: message.mediaUrl || null,
      fileName: message.fileName || null,
      fileSize: message.fileSize || null,

      // Status fields (initialized)
      readBy: [],
      reactions: {},
      duration: null,
      replyTo: message.replyTo || null,
      deleted: false,

      // Metadata
      createdAt: now,
    }

    // Write to DynamoDB using AppSync's ddb utilities
    return ddb.put({
      key: {
        conversationId: item.conversationId,
        timestamp: item.timestamp,
      },
      item,
    })
  },

  response(ctx) {
    // Add server timestamp to all events before broadcasting
    const now = util.time.nowISO8601()

    return ctx.events.map(event => {
      const parsed = typeof event === 'string' ? JSON.parse(event) : event
      parsed.serverTimestamp = now
      return JSON.stringify(parsed)
    })
  }
}
```

#### Important Considerations

1. **Batch Processing:** If you send multiple events in a batch, only the first MESSAGE_SENT event is persisted. Modify the handler to loop through all events if needed.

2. **Error Handling:** If the DynamoDB write fails, the event is still broadcast to subscribers. Monitor CloudWatch logs for persistence failures.

3. **Conditional Writes:** You can add `condition` to `ddb.put()` to prevent duplicate writes:
   ```javascript
   return ddb.put({
     key: { conversationId, timestamp },
     item,
     condition: { conversationId: { attributeExists: false } }
   })
   ```

4. **If using this approach**, you should modify `src/services/messageService.ts` to remove the DynamoDB write from `sendMessage()` since AppSync will handle it.

---

### Step 1.4: Configure Subscribe Authorization (Recommended)

With user-centric channels, security is simpler - users can only subscribe to their own channels:

```javascript
// onSubscribe handler - validates user-centric channel ownership
export function onSubscribe(ctx) {
  const channel = ctx.channel;
  const identity = ctx.identity;
  const userId = identity.sub; // Cognito user ID

  // User-centric channels: /chats/{userId}, /users/{userId}
  // Users can ONLY subscribe to their own channels
  if (
    channel.startsWith("/chats/") ||
    channel.startsWith("/users/")
  ) {
    const channelUserId = channel.split("/")[2];
    if (channelUserId !== userId) {
      util.error("Unauthorized: Cannot subscribe to other users' channels");
    }
  }

  // /calls/{sessionId} - allow any authenticated user (session validation is in API)
  // In production, you could validate the user is a participant via DynamoDB lookup

  return ctx.events;
}
```

### Step 1.5: Note Your Endpoints

Save these for environment variables:

```bash
# HTTP endpoint for publishing events
NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/event

# WebSocket endpoint for subscriptions
NEXT_PUBLIC_APPSYNC_REALTIME_ENDPOINT=wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime
```

---

## Phase 2: Create AppSync Client with Amplify

This phase uses **AWS Amplify's `events` module** for AppSync Events subscriptions. This is the recommended approach as it handles:

- WebSocket connection management
- Automatic reconnection
- Token refresh
- Connection multiplexing

### Step 2.1: Install Amplify Events Package

```bash
npm install @aws-amplify/api
```

### Step 2.2: Configure Amplify for AppSync Events

Update `src/lib/amplify/amplify-config.ts` to include AppSync Events configuration:

```typescript
import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    },
  },
  // Add AppSync Events configuration
  API: {
    Events: {
      endpoint: process.env.NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT!,
      region: "us-east-1",
      defaultAuthMode: "userPool", // Uses Cognito tokens automatically
    },
  },
});
```

### Step 2.3: Create AppSync Client Module

Create a new file: `src/lib/appsync-client.ts`

```typescript
/**
 * AWS AppSync Events Client
 *
 * Uses AWS Amplify's events module for real-time subscriptions
 * Replaces Socket.IO for real-time functionality
 */

"use client";

import { events } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";

// HTTP endpoint for server-side publishing
const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT!;

// ============================================================================
// Types
// ============================================================================

export type MessageEventType =
  | "MESSAGE_SENT"
  | "MESSAGE_DELETED"
  | "MESSAGE_UPDATED"
  | "MESSAGE_READ";

export type TypingEventType = "USER_TYPING" | "USER_STOPPED_TYPING";

export type CallEventType =
  | "INCOMING_CALL"
  | "CALL_RINGING"
  | "CALL_CONNECTED"
  | "CALL_REJECTED"
  | "CALL_ENDED"
  | "CALL_ERROR"
  | "PARTICIPANT_LEFT";

export type EventType = MessageEventType | TypingEventType | CallEventType;

export interface AppSyncEvent<T = unknown> {
  type: EventType;
  data: T;
  timestamp?: string;
  serverTimestamp?: string;
}

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
 * // Later, to unsubscribe:
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

    console.log(`[AppSync] Subscribed to ${channelPath}`);

    return {
      close: () => {
        channel.close();
        console.log(`[AppSync] Unsubscribed from ${channelPath}`);
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
// Publishing (using Amplify events.post)
// ============================================================================

/**
 * Publish an event to an AppSync Events channel
 *
 * @example
 * await publishEvent('/chats/conv-123', {
 *   type: 'MESSAGE_SENT',
 *   data: { messageId: 'msg-456', content: 'Hello' }
 * });
 */
export async function publishEvent<T>(
  channel: string,
  event: AppSyncEvent<T>
): Promise<void> {
  // Add client timestamp
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  try {
    await events.post(channel, eventWithTimestamp);
    console.log(`[AppSync] Published ${event.type} to ${channel}`);
  } catch (error) {
    console.error(`[AppSync] Failed to publish to ${channel}:`, error);
    throw error;
  }
}

/**
 * Publish multiple events to a channel
 */
export async function batchPublish<T>(
  channel: string,
  eventList: AppSyncEvent<T>[]
): Promise<void> {
  const eventsWithTimestamp = eventList.map((event) => ({
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  }));

  // Amplify events.post can accept an array
  await events.post(channel, eventsWithTimestamp);
  console.log(`[AppSync] Published ${eventList.length} events to ${channel}`);
}

// ============================================================================
// Server-side Publishing (for API routes)
// ============================================================================

/**
 * Publish from server-side (API routes) using HTTP
 * Use this in Next.js API routes where Amplify client isn't available
 */
export async function publishEventFromServer<T>(
  channel: string,
  event: AppSyncEvent<T>,
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
    const error = await response.text();
    throw new Error(`AppSync publish failed: ${response.status} - ${error}`);
  }

  console.log(`[AppSync] Server published ${event.type} to ${channel}`);
}

// ============================================================================
// User-Centric Subscription Functions
// ============================================================================
// With user-centric channels, each user subscribes to their own channel
// instead of subscribing to each conversation. This reduces subscription
// management from 20-40+ channels to just 3-4 fixed channels.

/**
 * Subscribe to ALL messages for the current user (user-centric model)
 *
 * Messages from all conversations arrive on this single channel.
 * Filter by conversationId in the event data if needed.
 */
export async function subscribeToUserMessages(
  userId: string,
  onMessage: (event: AppSyncEvent<unknown>) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/chats/${userId}`, {
    onEvent: onMessage,
    onError,
  });
}

/**
 * Subscribe to ALL typing indicators for the current user
 *
 * Typing events from all conversations arrive on this single channel.
 * Filter by conversationId in the event data if needed.
 */
export async function subscribeToUserTyping(
  userId: string,
  onTyping: (
    event: AppSyncEvent<{ userId: string; conversationId: string }>
  ) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/typing/${userId}`, {
    onEvent: onTyping,
    onError,
  });
}

/**
 * Subscribe to direct notifications (incoming calls, call status)
 */
export async function subscribeToUserNotifications(
  userId: string,
  onNotification: (event: AppSyncEvent<unknown>) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/users/${userId}`, {
    onEvent: onNotification,
    onError,
  });
}

/**
 * Subscribe to call session events (during active call)
 */
export async function subscribeToCallSession(
  sessionId: string,
  onEvent: (event: AppSyncEvent<unknown>) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/calls/${sessionId}`, {
    onEvent: onEvent,
    onError,
  });
}

// ============================================================================
// Multi-Publish Helper (for API routes)
// ============================================================================

/**
 * Publish an event to multiple user channels
 *
 * Used by API routes to broadcast to all conversation participants.
 * For a 10-person group chat, this publishes to 10 channels.
 */
export async function publishToUsers<T>(
  userIds: string[],
  channelPrefix: string,
  event: AppSyncEvent<T>
): Promise<void> {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  await Promise.all(
    userIds.map((userId) =>
      events.post(`${channelPrefix}/${userId}`, eventWithTimestamp)
    )
  );

  console.log(
    `[AppSync] Published ${event.type} to ${userIds.length} user channels`
  );
}

// ============================================================================
// Export
// ============================================================================

export default {
  // Core functions
  publishEvent,
  batchPublish,
  publishEventFromServer,
  subscribeToChannel,
  subscribeToChannels,

  // User-centric subscriptions
  subscribeToUserMessages,
  subscribeToUserTyping,
  subscribeToUserNotifications,
  subscribeToCallSession,

  // Multi-publish helper
  publishToUsers,
};
```

### Step 2.4: Add Event Type Definitions

Create `src/types/appsync-events.ts`:

```typescript
/**
 * AppSync Event Types
 *
 * Type definitions for all real-time events
 */

// ============================================================================
// Message Events
// ============================================================================

export interface MessageSentEvent {
  type: "MESSAGE_SENT";
  data: {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "FILE";
    timestamp: string;
    tempId?: string; // Client-side temporary ID for optimistic updates
  };
}

export interface MessageDeletedEvent {
  type: "MESSAGE_DELETED";
  data: {
    messageId: string;
    conversationId: string;
    deletedBy: string;
  };
}

export interface MessageReadEvent {
  type: "MESSAGE_READ";
  data: {
    messageId: string;
    conversationId: string;
    readBy: string;
    readAt: string;
  };
}

// ============================================================================
// Typing Events
// ============================================================================

export interface UserTypingEvent {
  type: "USER_TYPING";
  data: {
    userId: string;
    conversationId: string;
  };
}

export interface UserStoppedTypingEvent {
  type: "USER_STOPPED_TYPING";
  data: {
    userId: string;
    conversationId: string;
  };
}

// ============================================================================
// Call Events
// ============================================================================

export interface IncomingCallEvent {
  type: "INCOMING_CALL";
  data: {
    sessionId: string;
    callerId: string;
    callerName: string;
    callType: "AUDIO" | "VIDEO";
  };
}

export interface CallRingingEvent {
  type: "CALL_RINGING";
  data: {
    sessionId: string;
    recipientId: string;
  };
}

export interface CallConnectedEvent {
  type: "CALL_CONNECTED";
  data: {
    sessionId: string;
    meeting: {
      MeetingId: string;
      MediaPlacement: {
        AudioHostUrl: string;
        AudioFallbackUrl: string;
        SignalingUrl: string;
        TurnControlUrl: string;
      };
    };
    attendees: {
      [userId: string]: {
        AttendeeId: string;
        JoinToken: string;
      };
    };
  };
}

export interface CallRejectedEvent {
  type: "CALL_REJECTED";
  data: {
    sessionId: string;
    rejectedBy: string;
  };
}

export interface CallEndedEvent {
  type: "CALL_ENDED";
  data: {
    sessionId: string;
    endedBy: string;
  };
}

export interface ParticipantLeftEvent {
  type: "PARTICIPANT_LEFT";
  data: {
    sessionId: string;
    userId: string;
  };
}

export interface CallErrorEvent {
  type: "CALL_ERROR";
  data: {
    sessionId?: string;
    error: string;
  };
}

// ============================================================================
// Union Types
// ============================================================================

export type MessageEvent =
  | MessageSentEvent
  | MessageDeletedEvent
  | MessageReadEvent;

export type TypingEvent = UserTypingEvent | UserStoppedTypingEvent;

export type CallEvent =
  | IncomingCallEvent
  | CallRingingEvent
  | CallConnectedEvent
  | CallRejectedEvent
  | CallEndedEvent
  | ParticipantLeftEvent
  | CallErrorEvent;

export type AppSyncEventUnion = MessageEvent | TypingEvent | CallEvent;
```

---

## Phase 3: Migrate Messaging

### Step 3.0: Create Auth Utility (Required First)

Before creating API routes, create a shared authentication utility:

Create `src/lib/auth/api-auth.ts`:

```typescript
import { cookies } from "next/headers";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/lib/amplify/amplify-server-utils";

export interface AuthResult {
  userId: string;
  email?: string;
  accessToken: string;
}

/**
 * Get the authenticated user from the request context.
 * Uses Amplify server-side auth to verify the JWT token.
 */
export async function getAuthenticatedUser(): Promise<AuthResult | null> {
  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    const accessToken = session.tokens?.accessToken;
    const userId = accessToken?.payload?.sub as string | undefined;

    if (!userId || !accessToken) {
      return null;
    }

    return {
      userId,
      email: accessToken.payload?.email as string | undefined,
      accessToken: accessToken.toString(),
    };
  } catch (error) {
    console.error("[Auth] Failed to get authenticated user:", error);
    return null;
  }
}

/**
 * Verify that the provided userId matches the authenticated user.
 */
export function verifyUserMatch(
  bodyUserId: string | undefined,
  authUserId: string
): boolean {
  if (!bodyUserId) return true;
  return bodyUserId === authUserId;
}
```

### Step 3.1: Create Message Send API Route

Create `src/app/api/messages/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { messageService } from "@/services/messageService";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appsync-client";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Verify the senderId matches the authenticated user (if provided)
    if (!verifyUserMatch(body.senderId, auth.userId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot send messages as another user" },
        { status: 403 }
      );
    }

    const { conversationId, content, type = "TEXT", tempId } = body;

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: "conversationId and content are required" },
        { status: 400 }
      );
    }

    // Verify user is a participant in this conversation
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!conversation.participants.includes(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this conversation" },
        { status: 403 }
      );
    }

    // Save message to DynamoDB
    const message = await messageService.sendMessage({
      conversationId,
      senderId: auth.userId, // Use authenticated userId
      content,
      type,
    });

    // Update conversation last message timestamp
    await conversationService.updateLastMessage(
      conversationId,
      message.timestamp
    );

    // USER-CENTRIC: Publish to each participant's channel
    // (conversation was already fetched above for participant check)
    // For a 2-person chat, this publishes to 2 channels
    // For a 10-person group, this publishes to 10 channels
    await publishToUsers(conversation.participants, "/chats", {
      type: "MESSAGE_SENT",
      data: {
        ...message,
        tempId, // Include tempId for optimistic update matching
      },
    });

    return NextResponse.json({
      success: true,
      messageId: message.messageId,
      tempId,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 500 }
    );
  }
}
```

### Step 3.2: Create Typing Indicator API Routes

Create `src/app/api/messages/typing/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { publishToUsers } from "@/lib/appsync-client";
import { conversationService } from "@/services/conversationService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, isTyping } = await request.json();

    // Verify user is a participant in this conversation
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (!conversation.participants.includes(auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this conversation" },
        { status: 403 }
      );
    }

    // Get all OTHER participants (don't send typing to self)
    const otherParticipantIds = conversation.participants.filter(
      (id) => id !== auth.userId
    );

    // Publish to /chats channel (same as messages) for unified subscription
    await publishToUsers(otherParticipantIds, "/chats", {
      type: isTyping ? "USER_TYPING" : "USER_STOPPED_TYPING",
      data: {
        userId: auth.userId,
        conversationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error publishing typing event:", error);
    return NextResponse.json(
      { error: "Failed to publish typing event" },
      { status: 500 }
    );
  }
}
```

### Step 3.3: Create useMessages Hook (User-Centric)

This hook uses **user-centric subscriptions**. The user subscribes to their `/chats/{userId}` channel once, which receives both messages AND typing indicators. This simplifies the subscription model.

Create `src/hooks/useMessages.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { subscribeToUserMessages } from "@/lib/appsync-client";
import type {
  ChatEvent,
  MessageSentEvent,
  UserTypingEvent,
  UserStoppedTypingEvent,
} from "@/types/appsync-events";

interface Message {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  timestamp: string;
}

interface UseMessagesOptions {
  userId: string; // Current user's ID (for subscription)
  conversationId: string; // Current conversation to filter for
  onNewMessage?: (message: Message) => void;
}

interface TypingUser {
  userId: string;
  conversationId: string;
  timestamp: number;
}

export function useMessages({
  userId,
  conversationId,
  onNewMessage,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // USER-CENTRIC: Subscribe to /chats/{userId} for BOTH messages AND typing
  // This single subscription handles all chat events
  useEffect(() => {
    if (!userId) return;

    let subscription: { close: () => void } | null = null;

    const subscribe = async () => {
      try {
        // Single subscription for messages AND typing events
        subscription = await subscribeToUserMessages(
          userId,
          (event: ChatEvent) => {
            // Handle message events
            if (event.type === "MESSAGE_SENT") {
              const messageEvent = event as MessageSentEvent;
              const newMessage = messageEvent.data;

              if (newMessage.conversationId !== conversationId) {
                // Could emit a notification for other chats here
                return;
              }

              setMessages((prev) => {
                const exists = prev.some(
                  (m) => m.messageId === newMessage.messageId
                );
                if (exists) return prev;
                return [...prev, newMessage];
              });

              onNewMessage?.(newMessage);
            }

            // Handle typing events (now on same channel)
            if (event.type === "USER_TYPING" || event.type === "USER_STOPPED_TYPING") {
              const typingEvent = event as UserTypingEvent | UserStoppedTypingEvent;
              const { userId: typingUserId, conversationId: typingConvId } = typingEvent.data;

              if (typingConvId !== conversationId) return;

              if (event.type === "USER_TYPING") {
                setTypingUsers((prev) => {
                  const existing = prev.find(
                    (u) => u.userId === typingUserId && u.conversationId === typingConvId
                  );
                  if (existing) {
                    return prev.map((u) =>
                      u.userId === typingUserId && u.conversationId === typingConvId
                        ? { ...u, timestamp: Date.now() }
                        : u
                    );
                  }
                  return [...prev, { userId: typingUserId, conversationId: typingConvId, timestamp: Date.now() }];
                });

                // Clear after 3 seconds if no update
                const key = `${typingUserId}-${typingConvId}`;
                const existingTimeout = typingTimeoutRef.current.get(key);
                if (existingTimeout) clearTimeout(existingTimeout);

                typingTimeoutRef.current.set(
                  key,
                  setTimeout(() => {
                    setTypingUsers((prev) =>
                      prev.filter((u) => !(u.userId === typingUserId && u.conversationId === typingConvId))
                    );
                  }, 3000)
                );
              } else {
                setTypingUsers((prev) =>
                  prev.filter((u) => !(u.userId === typingUserId && u.conversationId === typingConvId))
                );
                const key = `${typingUserId}-${typingConvId}`;
                const timeout = typingTimeoutRef.current.get(key);
                if (timeout) clearTimeout(timeout);
              }
            }
          },
          (err) => setError(err)
        );

        setIsConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Subscription failed"));
      }
    };

    subscribe();

    return () => {
      subscription?.close();
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, [userId]); // Note: Only depends on userId, not conversationId!

  // Clear messages when conversation changes
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
  }, [conversationId]);

  // Send message function
  const sendMessage = useCallback(
    async (content: string, type = "TEXT") => {
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Optimistic update
      const optimisticMessage: Message = {
        messageId: tempId,
        conversationId,
        senderId: userId,
        content,
        type,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const response = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content, type, tempId }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Message will be updated via subscription with real ID
      } catch (err) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.messageId !== tempId));
        throw err;
      }
    },
    [conversationId, userId]
  );

  // Typing indicator functions
  const startTyping = useCallback(async () => {
    await fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, isTyping: true }),
    });
  }, [conversationId]);

  const stopTyping = useCallback(async () => {
    await fetch("/api/messages/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, isTyping: false }),
    });
  }, [conversationId]);

  return {
    messages,
    typingUsers: typingUsers.filter((u) => u.conversationId === conversationId),
    isConnected,
    error,
    sendMessage,
    startTyping,
    stopTyping,
  };
}
```

**Key differences from per-conversation approach:**

1. **Single subscription** - Subscribes to `/chats/{userId}` once for BOTH messages AND typing
2. **Unified channel** - Messages and typing indicators arrive on the same channel
3. **Filters by conversationId** - Incoming events are filtered to show only the current conversation
4. **Stable subscription** - The WebSocket doesn't reconnect when switching conversations
5. **Pass userId** - The hook requires the current user's ID for the subscription

---

## Phase 4: Migrate Call Signaling

### Step 4.1: Create Call API Routes

Create `src/app/api/calls/initiate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/socket/callManager";
import { publishEvent } from "@/lib/appsync-client";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";
import type { CallType } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipientId, callerName, callType } = body;

    // Verify the initiatedBy matches the authenticated user (if provided)
    if (!verifyUserMatch(body.initiatedBy, auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: Cannot initiate calls as another user" },
        { status: 403 }
      );
    }

    if (!recipientId || !callerName || !callType) {
      return NextResponse.json(
        { error: "recipientId, callerName, and callType are required" },
        { status: 400 }
      );
    }

    // Create call record (status: RINGING)
    const call = await callManager.initiateCall({
      callType: callType as CallType,
      initiatedBy: auth.userId, // Use authenticated userId
      participantIds: [recipientId, auth.userId],
    });

    // Notify caller that call is ringing
    await publishEvent(`/users/${auth.userId}`, {
      type: "CALL_RINGING",
      data: {
        sessionId: call.sessionId,
        recipientId,
      },
    });

    // Notify recipient of incoming call
    await publishEvent(`/users/${recipientId}`, {
      type: "INCOMING_CALL",
      data: {
        sessionId: call.sessionId,
        callerId: auth.userId,
        callerName,
        callType,
      },
    });

    console.log(`[Calls] Call initiated: ${call.sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId: call.sessionId,
    });
  } catch (error) {
    console.error("Error initiating call:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to initiate call",
      },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/calls/accept/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/socket/callManager";
import { publishEvent } from "@/lib/appsync-client";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, callerId, callerName } = await request.json();

    if (!sessionId || !callerId) {
      return NextResponse.json(
        { error: "sessionId and callerId are required" },
        { status: 400 }
      );
    }

    // Create Chime meeting and join both parties
    const result = await callManager.acceptAndConnectCall({
      sessionId,
      recipientId: auth.userId, // Use authenticated userId
      recipientName: auth.userId, // TODO: Get from user service
      callerId,
      callerName,
    });

    const connectionData = {
      sessionId,
      meeting: result.meeting,
      attendees: result.attendees,
    };

    // Notify both parties that call is connected
    await Promise.all([
      publishEvent(`/users/${callerId}`, {
        type: "CALL_CONNECTED",
        data: connectionData,
      }),
      publishEvent(`/users/${auth.userId}`, {
        type: "CALL_CONNECTED",
        data: connectionData,
      }),
    ]);

    console.log(`[Calls] Call connected: ${sessionId}`);

    return NextResponse.json({
      success: true,
      ...connectionData,
    });
  } catch (error) {
    console.error("Error accepting call:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to accept call",
      },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/calls/reject/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/socket/callManager";
import { publishEvent } from "@/lib/appsync-client";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, callerId } = await request.json();

    // Update call record
    await callManager.rejectCall(sessionId, auth.userId);

    // Notify caller
    await publishEvent(`/users/${callerId}`, {
      type: "CALL_REJECTED",
      data: {
        sessionId,
        rejectedBy: auth.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting call:", error);
    return NextResponse.json(
      { error: "Failed to reject call" },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/calls/end/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/socket/callManager";
import { publishEvent } from "@/lib/appsync-client";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();

    // End the call
    const call = await callManager.endCall(sessionId);

    // Notify all participants
    await Promise.all(
      call.participants.map((participant) =>
        publishEvent(`/users/${participant.userId}`, {
          type: "CALL_ENDED",
          data: {
            sessionId,
            endedBy: auth.userId,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: "Failed to end call" }, { status: 500 });
  }
}
```

Create `src/app/api/calls/leave/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callManager } from "@/lib/socket/callManager";
import { publishEvent } from "@/lib/appsync-client";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();

    // Update participant status to LEFT
    const call = await callManager.leaveCall(sessionId, auth.userId);

    // Notify other participants
    await Promise.all(
      call.participants
        .filter((p) => p.userId !== auth.userId)
        .map((participant) =>
          publishEvent(`/users/${participant.userId}`, {
            type: "PARTICIPANT_LEFT",
            data: {
              sessionId,
              userId: auth.userId,
            },
          })
        )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving call:", error);
    return NextResponse.json(
      { error: "Failed to leave call" },
      { status: 500 }
    );
  }
}
```

### Step 4.2: Create useCall Hook (User-Centric)

The call hook already uses user-centric channels (`/users/{userId}` for incoming calls). This aligns perfectly with the user-centric subscription model.

Create `src/hooks/useCallAppSync.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToUserNotifications, // User-centric: receives all call events
  subscribeToCallSession,
} from "@/lib/appsync-client";
import type {
  IncomingCallEvent,
  CallConnectedEvent,
  CallRejectedEvent,
  CallEndedEvent,
  ParticipantLeftEvent,
  CallErrorEvent,
} from "@/types/appsync-events";

type CallEvent =
  | IncomingCallEvent
  | CallConnectedEvent
  | CallRejectedEvent
  | CallEndedEvent
  | ParticipantLeftEvent
  | CallErrorEvent;

interface IncomingCall {
  sessionId: string;
  callerId: string;
  callerName: string;
  callType: "AUDIO" | "VIDEO";
}

interface MeetingData {
  sessionId: string;
  meeting: CallConnectedEvent["data"]["meeting"];
  attendees: CallConnectedEvent["data"]["attendees"];
}

interface UseCallOptions {
  userId: string;
  onIncomingCall?: (call: IncomingCall) => void;
  onCallConnected?: (data: MeetingData) => void;
  onCallEnded?: (sessionId: string, endedBy: string) => void;
  onCallRejected?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

export function useCall({
  userId,
  onIncomingCall,
  onCallConnected,
  onCallEnded,
  onCallRejected,
  onError,
}: UseCallOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const callSubscriptionRef = useRef<{ close: () => void } | null>(null);

  // Subscribe to incoming calls for this user using Amplify events
  useEffect(() => {
    if (!userId) return;

    let subscription: { close: () => void } | null = null;

    const subscribe = async () => {
      try {
        // USER-CENTRIC: Subscribe to user's notification channel
        // Receives all call-related events (incoming, connected, ended, etc.)
        subscription = await subscribeToUserNotifications(
          userId,
          (event) => {
            const callEvent = event as CallEvent;

            switch (callEvent.type) {
              case "INCOMING_CALL":
                const incoming = callEvent.data as IncomingCallEvent["data"];
                setIncomingCall(incoming);
                onIncomingCall?.(incoming);
                break;

              case "CALL_RINGING":
                setIsRinging(true);
                break;

              case "CALL_CONNECTED":
                const connectedData =
                  callEvent.data as CallConnectedEvent["data"];
                setActiveSession(connectedData.sessionId);
                setIsRinging(false);
                setIncomingCall(null);
                onCallConnected?.(connectedData);
                break;

              case "CALL_REJECTED":
                setIsRinging(false);
                const rejectedData =
                  callEvent.data as CallRejectedEvent["data"];
                onCallRejected?.(rejectedData.sessionId);
                break;

              case "CALL_ENDED":
                setActiveSession(null);
                const endedData = callEvent.data as CallEndedEvent["data"];
                onCallEnded?.(endedData.sessionId, endedData.endedBy);
                break;

              case "CALL_ERROR":
                const errorData = callEvent.data as CallErrorEvent["data"];
                onError?.(errorData.error);
                break;
            }
          },
          (err) => onError?.(err.message)
        );

        setIsConnected(true);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to connect");
      }
    };

    subscribe();

    // Cleanup: close subscription when unmounting
    return () => {
      subscription?.close();
      callSubscriptionRef.current?.close();
    };
  }, [
    userId,
    onIncomingCall,
    onCallConnected,
    onCallEnded,
    onCallRejected,
    onError,
  ]);

  // Initiate a call
  const initiateCall = useCallback(
    async (
      recipientId: string,
      callerName: string,
      callType: "AUDIO" | "VIDEO"
    ) => {
      try {
        setIsRinging(true);

        const response = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId, callerName, callType }),
        });

        if (!response.ok) {
          throw new Error("Failed to initiate call");
        }

        const data = await response.json();
        return data.sessionId;
      } catch (err) {
        setIsRinging(false);
        throw err;
      }
    },
    []
  );

  // Accept an incoming call
  const acceptCall = useCallback(
    async (sessionId: string, callerId: string, callerName: string) => {
      try {
        const response = await fetch("/api/calls/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, callerId, callerName }),
        });

        if (!response.ok) {
          throw new Error("Failed to accept call");
        }

        const data = await response.json();
        setActiveSession(sessionId);
        setIncomingCall(null);

        return data;
      } catch (err) {
        throw err;
      }
    },
    []
  );

  // Reject an incoming call
  const rejectCall = useCallback(
    async (sessionId: string, callerId: string) => {
      try {
        await fetch("/api/calls/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, callerId }),
        });

        setIncomingCall(null);
      } catch (err) {
        console.error("Error rejecting call:", err);
      }
    },
    []
  );

  // Leave a call (without ending it)
  const leaveCall = useCallback(async (sessionId: string) => {
    try {
      await fetch("/api/calls/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      setActiveSession(null);
    } catch (err) {
      console.error("Error leaving call:", err);
    }
  }, []);

  // End a call (terminates for everyone)
  const endCall = useCallback(async (sessionId: string) => {
    try {
      await fetch("/api/calls/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      setActiveSession(null);
    } catch (err) {
      console.error("Error ending call:", err);
    }
  }, []);

  return {
    isConnected,
    activeSession,
    isRinging,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    leaveCall,
    endCall,
  };
}
```

---

## Phase 5: Remove Socket.IO

### Step 5.1: Delete Socket.IO Files

Delete the following files:

```bash
# Server files
rm server.ts
rm src/lib/socket/messageSocket.ts
rm src/lib/socket/callSocket.ts
rm src/lib/socket/socketUtils.ts
rm src/lib/socket/socketAuthMiddleware.ts

# Client files
rm src/lib/socket-client.ts

# Keep these files (still needed):
# - src/lib/socket/callManager.ts (business logic, still used by API routes)
```

### Step 5.2: Remove Dependencies

```bash
npm uninstall socket.io socket.io-client
```

### Step 5.3: Update package.json Scripts

Update `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

### Step 5.4: Remove Server Declaration

Delete the global declaration from any remaining files:

```typescript
// Remove this if it exists anywhere:
declare global {
  var io: Server | undefined;
}
```

---

## Phase 6: Deploy to Vercel

### Step 6.1: Prepare Repository

1. Ensure all changes are committed
2. Push to GitHub

### Step 6.2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Select "Next.js" as framework preset

### Step 6.3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```bash
# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_4fWvgNvC3
NEXT_PUBLIC_COGNITO_CLIENT_ID=2fahfmaruotenn36rnavjm51s5

# AppSync Events
NEXT_PUBLIC_APPSYNC_EVENT_HTTP_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/event
NEXT_PUBLIC_APPSYNC_REALTIME_ENDPOINT=wss://xxx.appsync-realtime-api.us-east-1.amazonaws.com/event/realtime

# AWS (for API routes)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# DynamoDB Tables
DYNAMODB_USERS_TABLE=PantherKolab-Users-prod
DYNAMODB_CONVERSATIONS_TABLE=PantherKolab-Conversations-prod
DYNAMODB_MESSAGES_TABLE=PantherKolab-Messages-prod
DYNAMODB_GROUPS_TABLE=PantherKolab-Groups-prod
DYNAMODB_CALLS_TABLE=PantherKolab-Calls-prod

# Chime
AWS_CHIME_REGION=us-east-1
```

### Step 6.4: Deploy

```bash
# Deploy to production
vercel --prod

# Or enable automatic deployments on push
```

### Step 6.5: Configure Custom Domain

1. Vercel Dashboard → Your Project → Settings → Domains
2. Add `pantherkolab.com`
3. Update DNS A record to point to Vercel

---

## Testing Checklist

### Messaging Tests

- [ ] Send a message and verify it appears in recipient's chat
- [ ] Verify message persists in DynamoDB
- [ ] Test typing indicators (start and stop)
- [ ] Test optimistic updates (message appears immediately)
- [ ] Test error handling (disconnect, network failure)
- [ ] Test message read receipts

### Call Tests

- [ ] Initiate a call and verify recipient sees incoming call modal
- [ ] Accept a call and verify both parties connect to Chime meeting
- [ ] Reject a call and verify caller is notified
- [ ] End a call and verify both parties disconnect
- [ ] Leave a call (in group call) and verify others are notified
- [ ] Test call error handling

### Performance Tests

- [ ] Measure message delivery latency (target: <200ms)
- [ ] Measure call connection time (target: <3s)
- [ ] Test with multiple concurrent users
- [ ] Monitor AppSync CloudWatch metrics

---

## Rollback Plan

### If Issues Arise

1. **Git Reset:**

   ```bash
   git checkout main
   git pull origin main  # Get the last known working version
   ```

2. **Re-deploy to EC2:**

   - Follow the EC2 deployment guide in [production-deployment.md](./production-deployment.md)

3. **DNS Revert:**
   - Point `pantherkolab.com` back to EC2 Elastic IP

### Keeping Both Options

Consider maintaining both deployment options:

- **Branch `main`**: AppSync Events (Vercel)
- **Branch `socketio`**: Socket.IO (EC2)

This allows quick switching if needed.

---

## Troubleshooting

### AppSync Connection Issues

**Symptom:** WebSocket connection fails or immediately disconnects

**Solutions:**

1. Verify Cognito token is valid and not expired
2. Check AppSync authorization configuration matches Cognito pool
3. Verify CORS is configured (though AppSync handles this automatically)
4. Check browser console for specific error messages

### Events Not Being Received

**Symptom:** Published events don't appear in subscribed clients

**Solutions:**

1. Verify channel names match exactly (case-sensitive)
2. Check onPublish handler isn't filtering out events
3. Verify subscription was successful (no errors in onSubscribe)
4. Check CloudWatch logs for AppSync API

### High Latency

**Symptom:** Messages take >500ms to appear

**Solutions:**

1. Check AWS region matches client location
2. Verify no errors causing retries
3. Consider using AppSync in additional regions
4. Check client-side rendering isn't causing delays

### Authentication Errors

**Symptom:** 401 Unauthorized errors

**Solutions:**

1. Verify access token is being passed correctly
2. Check token isn't expired (refresh if needed)
3. Verify Cognito User Pool ID matches AppSync configuration
4. Check IAM permissions for API routes

---

## Estimated Timeline

| Phase                        | Duration         | Notes              |
| ---------------------------- | ---------------- | ------------------ |
| Phase 1: AWS Setup           | 1-2 hours        | AWS Console work   |
| Phase 2: AppSync Client      | 2-3 hours        | New code           |
| Phase 3: Messaging Migration | 3-4 hours        | API routes + hooks |
| Phase 4: Call Migration      | 4-5 hours        | More complex logic |
| Phase 5: Remove Socket.IO    | 30 mins          | Cleanup            |
| Phase 6: Vercel Deploy       | 1 hour           | Configuration      |
| Testing                      | 2-3 hours        | All scenarios      |
| **Total**                    | **~15-20 hours** | 2-3 days of work   |

---

## Cost Comparison

### Before (EC2 + Socket.IO)

| Resource      | Monthly Cost   |
| ------------- | -------------- |
| EC2 t4g.micro | $6-8           |
| Elastic IP    | $0 (attached)  |
| EBS 20GB      | $1.60          |
| Data transfer | $1-3           |
| **Total**     | **~$10/month** |

### After (Vercel + AppSync)

| Resource                   | Monthly Cost    |
| -------------------------- | --------------- |
| Vercel Hobby               | $0              |
| AppSync Events (free tier) | $0              |
| DynamoDB (on-demand)       | $0-2            |
| Cognito (50K MAU free)     | $0              |
| **Total**                  | **~$0-2/month** |

**Savings: ~$8-10/month**

---

## References

- [AWS AppSync Events API Documentation](https://docs.aws.amazon.com/appsync/latest/eventapi/)
- [AppSync Events WebSocket Protocol](https://docs.aws.amazon.com/appsync/latest/eventapi/websocket-protocol.html)
- [Vercel Next.js Deployment](https://vercel.com/docs/frameworks/nextjs)
- [AWS Amplify Auth](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
