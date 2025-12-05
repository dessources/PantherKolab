/**
 * AppSync Event Types
 *
 * Type definitions for all real-time events
 */
import { Attendee } from "@aws-sdk/client-chime-sdk-meetings";

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
      [userId: string]: Attendee;
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

export interface ParticipantJoinedEvent {
  type: "PARTICIPANT_JOINED";
  data: {
    sessionId: string;
    userId: string;
    attendee: Attendee;
  };
}

export interface CallErrorEvent {
  type: "CALL_ERROR";
  data: {
    sessionId?: string;
    error: string;
  };
}

export interface CallCancelledEvent {
  type: "CALL_CANCELLED";
  data: {
    sessionId: string;
    cancelledBy: string;
  };
}

// ============================================================================
// Whiteboard Events
// ============================================================================

export interface WhiteboardCreatedEvent {
  type: "WHITEBOARD_CREATED";
  data: {
    whiteboardId: string;
    conversationId: string;
    name: string;
    createdBy: string;
  };
}

export interface WhiteboardUpdatedEvent {
  type: "WHITEBOARD_UPDATED";
  data: {
    whiteboardId: string;
    snapshot: string; // tldraw snapshot JSON
    updatedBy: string;
  };
}

export interface WhiteboardDeletedEvent {
  type: "WHITEBOARD_DELETED";
  data: {
    whiteboardId: string;
    deletedBy: string;
  };
}

export interface WhiteboardParticipantJoinedEvent {
  type: "WHITEBOARD_PARTICIPANT_JOINED";
  data: {
    whiteboardId: string;
    userId: string;
    userName: string;
  };
}

export interface WhiteboardParticipantLeftEvent {
  type: "WHITEBOARD_PARTICIPANT_LEFT";
  data: {
    whiteboardId: string;
    userId: string;
  };
}

export interface WhiteboardCursorMovedEvent {
  type: "WHITEBOARD_CURSOR_MOVED";
  data: {
    whiteboardId: string;
    userId: string;
    userName: string;
    x: number;
    y: number;
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

// ChatEvent combines messages and typing - all sent to /chats/{userId}
export type ChatEvent = MessageEvent | TypingEvent;

export type CallEvent =
  | IncomingCallEvent
  | CallRingingEvent
  | CallConnectedEvent
  | CallRejectedEvent
  | CallEndedEvent
  | CallCancelledEvent
  | ParticipantLeftEvent
  | ParticipantJoinedEvent
  | CallErrorEvent;

export type WhiteboardEvent =
  | WhiteboardCreatedEvent
  | WhiteboardUpdatedEvent
  | WhiteboardDeletedEvent
  | WhiteboardParticipantJoinedEvent
  | WhiteboardParticipantLeftEvent
  | WhiteboardCursorMovedEvent;

export type AppSyncEventUnion = ChatEvent | CallEvent | WhiteboardEvent;

// ============================================================================
// Generic Event Type
// ============================================================================
// For generic publishers or subscribers that don't need detailed type info

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
  | "CALL_CANCELLED"
  | "CALL_ERROR"
  | "PARTICIPANT_LEFT"
  | "PARTICIPANT_JOINED";

export type WhiteboardEventType =
  | "WHITEBOARD_CREATED"
  | "WHITEBOARD_UPDATED"
  | "WHITEBOARD_DELETED"
  | "WHITEBOARD_PARTICIPANT_JOINED"
  | "WHITEBOARD_PARTICIPANT_LEFT"
  | "WHITEBOARD_CURSOR_MOVED";

export type EventType =
  | MessageEventType
  | TypingEventType
  | CallEventType
  | WhiteboardEventType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AppSyncEvent<T = Record<string, any>> {
  type: EventType;
  data: T;
  timestamp?: string;
  serverTimestamp?: string;
}