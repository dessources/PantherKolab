# Socket.IO to AWS AppSync Events Migration Guide

This guide documents the migration of PantherKolab from Socket.IO to AWS AppSync Events for serverless deployment.

**Status: ✅ MIGRATION COMPLETE (2025-11-24)**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [Final Implementation](#final-implementation)
4. [Phase 1: AWS AppSync Events Setup](#phase-1-aws-appsync-events-setup)
5. [Phase 2: Create AppSync Client](#phase-2-create-appsync-client)
6. [Phase 3: Migrate Messaging](#phase-3-migrate-messaging)
7. [Phase 4: Migrate Call Signaling](#phase-4-migrate-call-signaling)
8. [Phase 5: Remove Socket.IO](#phase-5-remove-socketio)
9. [Phase 6: Deploy to Vercel](#phase-6-deploy-to-vercel)
10. [Testing Checklist](#testing-checklist)
11. [Rollback Plan](#rollback-plan)
12. [Troubleshooting](#troubleshooting)

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

## Final Implementation

This section documents the actual implementation that was completed.

### Channel Architecture

```
User-Centric Channel Model (2 channels per user):
├── /calls/{userId} - All call events for a user
│   ├── INCOMING_CALL - New incoming call notification
│   ├── CALL_RINGING - Call is ringing (for caller)
│   ├── CALL_CONNECTED - Call accepted with Chime credentials
│   ├── CALL_REJECTED - Recipient rejected the call
│   ├── CALL_CANCELLED - Caller cancelled before answer
│   ├── CALL_ENDED - Call terminated by owner
│   └── PARTICIPANT_LEFT - User left the call
│
└── /chats/{userId} - All message events for a user
    ├── MESSAGE_SENT - New message received
    ├── USER_TYPING - User started typing
    └── USER_STOPPED_TYPING - User stopped typing
```

### Key Files Created/Modified

| File                                       | Purpose                                      |
| ------------------------------------------ | -------------------------------------------- |
| `src/lib/appSync/appsync-server-client.ts` | Server-side publishing with Cognito ID token |
| `src/lib/appSync/appsync-client.ts`        | Client-side subscriptions using Amplify      |
| `src/lib/auth/api-auth.ts`                 | API route authentication helper              |
| `src/types/appsync-events.ts`              | TypeScript event type definitions            |

### Server-Side Publishing (Final Code)

**File: `src/lib/appSync/appsync-server-client.ts`**

```typescript
/**
 * AWS AppSync Events Client (Server-Side)
 *
 * For publishing events from Next.js API routes using Cognito token authentication.
 */

import { AppSyncEvent } from "@/types/appsync-events";

const HTTP_ENDPOINT = process.env.NEXT_PUBLIC_APPSYNC_HTTP_ENDPOINT!;

/**
 * Publish an event to a channel from the server-side.
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
      Authorization: authToken, // Cognito ID token
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

  console.log(`[AppSync] Server published ${event.type} to ${channel}`);
}

/**
 * Publish an event to multiple user-specific channels.
 */
export async function publishToUsers(
  userIds: string[],
  channelPrefix: string,
  event: AppSyncEvent,
  authToken: string
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => {
      const userChannel = `${channelPrefix}/${userId}`;
      return publishEvent(userChannel, event, authToken);
    })
  );

  console.log(
    `[AppSync] Published ${event.type} to ${userIds.length} user channels`
  );
}
```

### Client-Side Subscriptions (Final Code)

**File: `src/lib/appSync/appsync-client.ts`**

```typescript
"use client";

import { events } from "aws-amplify/api";
import { AppSyncEvent } from "@/types/appsync-events";

/**
 * Subscribe to an AppSync Events channel using Amplify
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

    channel.subscribe({
      next: (data) => {
        try {
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
 * Subscribe to ALL chat events for the current user (messages + typing)
 */
export async function subscribeToUserChats(
  userId: string,
  onEvent: (event: AppSyncEvent) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/chats/${userId}`, { onEvent, onError });
}

/**
 * Subscribe to ALL call events for the current user
 */
export async function subscribeToUserCalls(
  userId: string,
  onEvent: (event: AppSyncEvent) => void,
  onError?: (error: Error) => void
): Promise<{ close: () => void }> {
  return subscribeToChannel(`/calls/${userId}`, { onEvent, onError });
}
```

### API Route Authentication (Final Code)

**File: `src/lib/auth/api-auth.ts`**

```typescript
import { cookies } from "next/headers";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/lib/amplify/amplify-server-utils";

export interface AuthResult {
  userId: string;
  email?: string;
  accessToken: string;
  idToken: string; // Used for AppSync publishing
}

/**
 * Get the authenticated user from the request context.
 */
export async function getAuthenticatedUser(): Promise<AuthResult | null> {
  try {
    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    const accessToken = session.tokens?.accessToken;
    const idToken = session.tokens?.idToken;
    const userId = accessToken?.payload?.sub as string | undefined;

    if (!userId || !accessToken || !idToken) {
      return null;
    }

    return {
      userId,
      email: accessToken.payload?.email as string | undefined,
      accessToken: accessToken.toString(),
      idToken: idToken.toString(),
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

### API Route Pattern (Example: Initiate Call)

**File: `src/app/api/calls/initiate/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callService } from "@/services/callService";
import { userService } from "@/services/userService";
import { getAuthenticatedUser, verifyUserMatch } from "@/lib/auth/api-auth";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { callType, initiatedBy, participantIds, conversationId } = body;

    // 2. Verify the initiatedBy matches the authenticated user
    if (!verifyUserMatch(initiatedBy, auth.userId)) {
      return NextResponse.json(
        { error: "Forbidden: Cannot initiate calls as another user" },
        { status: 403 }
      );
    }

    // 3. Create call record (use authenticated userId)
    const call = await callService.createCall({
      callType,
      initiatedBy: auth.userId,
      participantIds,
      conversationId,
    });

    // 4. Get caller info for notifications
    const caller = await userService.getUser(auth.userId);
    const callerName = caller
      ? `${caller.firstName} ${caller.lastName}`
      : "Unknown";

    // 5. Notify the caller that the call is ringing
    await publishToUsers(
      [auth.userId],
      "/calls",
      {
        type: "CALL_RINGING",
        data: { sessionId: call.sessionId },
      },
      auth.idToken // Use ID token for AppSync auth
    );

    // 6. Notify all recipients about the incoming call
    await publishToUsers(
      participantIds.filter((p) => p !== auth.userId),
      "/calls",
      {
        type: "INCOMING_CALL",
        data: {
          sessionId: call.sessionId,
          callerId: auth.userId,
          callerName,
          callType: "AUDIO",
        },
      },
      auth.idToken
    );

    return NextResponse.json({ success: true, call });
  } catch (error) {
    console.error("Call initiation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
```

### All API Routes Updated

| Route                       | Events Published                      |
| --------------------------- | ------------------------------------- |
| `POST /api/calls/initiate`  | `CALL_RINGING`, `INCOMING_CALL`       |
| `POST /api/calls/accept`    | `CALL_CONNECTED`                      |
| `POST /api/calls/reject`    | `CALL_REJECTED`                       |
| `POST /api/calls/cancel`    | `CALL_CANCELLED`                      |
| `POST /api/calls/end`       | `CALL_ENDED`                          |
| `POST /api/calls/leave`     | `PARTICIPANT_LEFT`                    |
| `POST /api/messages/send`   | `MESSAGE_SENT`                        |
| `POST /api/messages/typing` | `USER_TYPING` / `USER_STOPPED_TYPING` |

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

| Namespace  | Purpose                      | Auth    | Notes                                          |
| ---------- | ---------------------------- | ------- | ---------------------------------------------- |
| `/chats/*` | Messages + typing indicators | Cognito | Each user subscribes to `/chats/{theirUserId}` |
| `/users/*` | Direct notifications (calls) | Cognito | Incoming calls, call status updates            |
| `/calls/*` | Active call session events   | Cognito | Subscribed only during active call             |

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

| Aspect                   | API Route (Recommended)             | onPublish Handler (Alternative)       |
| ------------------------ | ----------------------------------- | ------------------------------------- |
| Persistence confirmation | Synchronous (before broadcast)      | Asynchronous (after broadcast)        |
| Error handling           | Direct feedback to client           | Silent failures (requires monitoring) |
| API route complexity     | Higher (DynamoDB + AppSync publish) | Lower (AppSync only)                  |
| Debugging                | Easier (single location)            | Harder (check CloudWatch logs)        |
| Data consistency         | Guaranteed (save then broadcast)    | Eventual (broadcast then save)        |

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
         "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
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
import * as ddb from "@aws-appsync/utils/dynamodb";

export const onPublish = {
  request(ctx) {
    // Get the first event from the batch
    const event = ctx.events[0];

    // Parse the stringified event (AppSync Events require stringified payloads)
    const payload = typeof event === "string" ? JSON.parse(event) : event;

    // Only persist MESSAGE_SENT events to DynamoDB
    // Typing indicators, read receipts, etc. don't need persistence
    if (payload.type !== "MESSAGE_SENT") {
      // Return null to skip DynamoDB operation, event is still forwarded
      return null;
    }

    const message = payload.data;
    const now = util.time.nowISO8601();

    // Build the DynamoDB item matching existing table schema
    // See src/services/messageService.ts for field definitions
    const item = {
      // Primary key
      conversationId: message.conversationId,
      timestamp: message.timestamp || now,

      // Message fields
      messageId: message.messageId,
      senderId: message.senderId,
      type: message.type || "TEXT",
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
    };

    // Write to DynamoDB using AppSync's ddb utilities
    return ddb.put({
      key: {
        conversationId: item.conversationId,
        timestamp: item.timestamp,
      },
      item,
    });
  },

  response(ctx) {
    // Add server timestamp to all events before broadcasting
    const now = util.time.nowISO8601();

    return ctx.events.map((event) => {
      const parsed = typeof event === "string" ? JSON.parse(event) : event;
      parsed.serverTimestamp = now;
      return JSON.stringify(parsed);
    });
  },
};
```

#### Important Considerations

1. **Batch Processing:** If you send multiple events in a batch, only the first MESSAGE_SENT event is persisted. Modify the handler to loop through all events if needed.

2. **Error Handling:** If the DynamoDB write fails, the event is still broadcast to subscribers. Monitor CloudWatch logs for persistence failures.

3. **Conditional Writes:** You can add `condition` to `ddb.put()` to prevent duplicate writes:

   ```javascript
   return ddb.put({
     key: { conversationId, timestamp },
     item,
     condition: { conversationId: { attributeExists: false } },
   });
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
  if (channel.startsWith("/chats/") || channel.startsWith("/users/")) {
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

**IMPORTANT:** The Amplify configuration for AppSync Events is handled in the client-side Amplify initialization. Ensure your Amplify config includes the Events API configuration.

The key environment variable needed:

```bash
NEXT_PUBLIC_APPSYNC_HTTP_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/event
```

### Step 2.3: Create AppSync Client Module

**IMPORTANT:** The final implementation separates client and server code:

1. **Client-side** (`src/lib/appSync/appsync-client.ts`) - Subscriptions only using Amplify `events`
2. **Server-side** (`src/lib/appSync/appsync-server-client.ts`) - Publishing only using fetch with Cognito ID token

See the [Final Implementation](#final-implementation) section above for the complete code.

### Step 2.4: Add Event Type Definitions

The event type definitions are in `src/types/appsync-events.ts`. Key additions include:

- `CallCancelledEvent` - for when caller cancels before answer
- `ChatEvent` union type - combines messages and typing events (sent to `/chats/{userId}`)
- Generic `AppSyncEvent<T>` type for flexible typing

See the actual file for the complete type definitions.

---

## Phase 3: Migrate Messaging

### Step 3.0: Create Auth Utility (Required First)

The auth utility is documented in the [Final Implementation](#api-route-authentication-final-code) section above.

**Key change from original plan:** The `AuthResult` interface now includes `idToken` in addition to `accessToken`. The `idToken` is required for AppSync Events authentication.

### Step 3.1: Create Message Send API Route

**File: `src/app/api/messages/send/route.ts`**

Key changes from the original plan:

- Import `publishToUsers` from `@/lib/appSync/appsync-server-client` (not appsync-client)
- Pass `auth.idToken` as the 4th parameter to `publishToUsers`

```typescript
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

// In the route handler:
await publishToUsers(
  conversation.participants,
  "/chats",
  {
    type: "MESSAGE_SENT",
    data: {
      ...message,
      tempId,
    },
  },
  auth.idToken // Cognito ID token for AppSync auth
);
```

### Step 3.2: Create Typing Indicator API Routes

**File: `src/app/api/messages/typing/route.ts`**

Same pattern as message send - use `publishToUsers` from server client with `auth.idToken`:

```typescript
import { publishToUsers } from "@/lib/appSync/appsync-server-client";

// In the route handler:
await publishToUsers(
  otherParticipantIds,
  "/chats",
  {
    type: isTyping ? "USER_TYPING" : "USER_STOPPED_TYPING",
    data: {
      userId: auth.userId,
      conversationId,
    },
  },
  auth.idToken
);
```

### Step 3.3: Create useMessages Hook (User-Centric)

This hook uses **user-centric subscriptions**. The user subscribes to their `/chats/{userId}` channel once, which receives both messages AND typing indicators.

**Key design decisions:**

1. **Single subscription** - Subscribes to `/chats/{userId}` once for BOTH messages AND typing
2. **Unified channel** - Messages and typing indicators arrive on the same channel
3. **Filters by conversationId** - Incoming events are filtered to show only the current conversation
4. **Stable subscription** - The WebSocket doesn't reconnect when switching conversations
5. **Pass userId** - The hook requires the current user's ID for the subscription

The hook uses `subscribeToUserChats` from `@/lib/appSync/appsync-client`.

---

## Phase 4: Migrate Call Signaling

### Step 4.1: Create Call API Routes

All call routes follow the same pattern documented in the [Final Implementation](#api-route-pattern-example-initiate-call) section.

**Key differences from original plan:**

1. **Import path changed**: `callManager` is now at `@/lib/chime/callManager` (not `@/lib/socket/callManager`)
2. **Use `publishToUsers`**: Instead of `publishEvent`, use `publishToUsers` from `appsync-server-client`
3. **Channel prefix**: All call events go to `/calls` channel (not `/users`)
4. **Auth token**: Pass `auth.idToken` as the 4th parameter

**Example pattern for all call routes:**

```typescript
import { callManager } from "@/lib/chime/callManager";
import { publishToUsers } from "@/lib/appSync/appsync-server-client";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

// Publish to all participants
await publishToUsers(
  participantIds,
  "/calls", // Channel prefix
  {
    type: "CALL_CONNECTED",
    data: connectionData,
  },
  auth.idToken // Cognito ID token
);
```

**Routes implemented:**

- `POST /api/calls/initiate` - Create call, notify with `CALL_RINGING` and `INCOMING_CALL`
- `POST /api/calls/accept` - Create Chime meeting, notify with `CALL_CONNECTED`
- `POST /api/calls/reject` - Mark rejected, notify with `CALL_REJECTED`
- `POST /api/calls/cancel` - Cancel ringing call, notify with `CALL_CANCELLED`
- `POST /api/calls/end` - End call for all, notify with `CALL_ENDED`
- `POST /api/calls/leave` - Leave without ending, notify with `PARTICIPANT_LEFT`

### Step 4.2: Create useCalls Hook (User-Centric)

**Update from original plan:** The hook uses `/calls/{userId}` channel (not `/users/{userId}`).

The hook uses `subscribeToUserCalls` from `@/lib/appSync/appsync-client` to receive all call events.

**Key hook file:** `src/hooks/useCalls.ts`

The hook:

- Subscribes to `/calls/{userId}` using `subscribeToUserCalls`
- Handles all call event types via a switch statement
- Provides methods: `initiateCall`, `acceptCall`, `rejectCall`, `cancelCall`, `leaveCall`, `endCall`

---

## Phase 5: Remove Socket.IO

### Step 5.1: Files to Delete

```bash
# Unused legacy files
rm src/lib/appsync-events.ts  # Old event publisher (replaced by appsync-server-client)

# Socket.IO files (when ready to fully remove)
rm src/lib/socket/messageSocket.ts
rm src/lib/socket/callSocket.ts
rm src/lib/socket/socketUtils.ts
rm src/lib/socket/socketAuthMiddleware.ts
rm src/lib/socket-client.ts
```

### Step 5.2: Files to Keep/Move

```bash
# callManager.ts moved from socket/ to chime/
# Old: src/lib/socket/callManager.ts
# New: src/lib/chime/callManager.ts

# server.ts - Keep for now, marked as legacy
# Can be removed once AppSync is fully tested
```

### Step 5.3: Update package.json Scripts

The scripts have been updated:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint"
  }
}
```

### Step 5.4: Dependencies

Socket.IO dependencies can be removed once migration is fully tested:

```bash
npm uninstall socket.io socket.io-client
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
APP_AWS_SECRET_ACCESS_KEY=your-secret-key
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

1. **Use ID token, not access token** - AppSync Events requires the Cognito ID token for authentication
2. Check token isn't expired (refresh if needed)
3. Verify Cognito User Pool ID matches AppSync configuration
4. Check IAM permissions for API routes

### Stack Overflow in runWithAmplifyServerContext

**Symptom:** Maximum call stack size exceeded error

**Solution:** Don't use client-side Amplify libraries in server-side code. Use direct fetch with Cognito ID token instead of Amplify API calls.

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

---

## Migration Summary

**Completed: 2025-11-24**

### What Changed

| Before                         | After                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| Socket.IO server (`server.ts`) | Next.js API routes                                           |
| `@/lib/socket/callManager.ts`  | `@/lib/chime/callManager.ts`                                 |
| `@/lib/socket-client.ts`       | `@/lib/appSync/appsync-client.ts`                            |
| N/A                            | `@/lib/appSync/appsync-server-client.ts`                     |
| N/A                            | `@/lib/auth/api-auth.ts`                                     |
| Per-conversation channels      | User-centric channels (`/calls/{userId}`, `/chats/{userId}`) |
| Access token auth              | ID token auth for AppSync                                    |

### Key Learnings

1. **Separate client and server code** - Don't mix Amplify client code with server-side API routes
2. **Use ID token for AppSync** - Access tokens don't work for AppSync Events authentication
3. **User-centric channels simplify subscriptions** - Only 2 channels per user instead of per-conversation
4. **Cognito token must be passed explicitly** - Server-side code needs the ID token passed as a parameter
