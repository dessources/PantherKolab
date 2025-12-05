// Database Models for PantherKolab DynamoDB Tables

import { UserProfile } from "./UserProfile";

export type AcademicYear =
  | "Freshman"
  | "Sophomore"
  | "Junior"
  | "Senior"
  | "Graduate";

/**
 * Conversation
 * Table: PantherKolab-Conversations-{env}
 * Primary Key: conversationId
 */
export interface Conversation {
  conversationId: string; // UUID - Partition key
  type: ConversationType; // DM or GROUP
  name: string; // Group name (set to the other user's name for DMs)
  description: string | null; // Group description
  participants: string[]; // Array of userIds
  admins: string[]; // Array of admin userIds (for groups)
  createdBy: string; // Creator userId
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  lastMessageAt: string; // ISO timestamp for sorting
  avatar: string | null; // S3 URL for group avatar
}

export interface ConversationWithNames extends Conversation {
  participantNames: { [userId: string]: string };
}

export type ConversationType = "DM" | "GROUP";

/**
 * Message
 * Table: PantherKolab-Messages-{env}
 * Primary Key: conversationId (PK) + timestamp (SK)
 */
export interface Message {
  conversationId: string; // Partition key
  timestamp: string; // Sort key (ISO timestamp)
  messageId: string; // UUID
  senderId: string; // User ID who sent the message
  type: MessageType; // Message content type
  content: string | null; // Text content (for text messages)
  mediaUrl: string | null; // S3 URL for media files
  fileName: string | null; // Original file name
  fileSize: number | null; // File size in bytes
  duration: number | null; // Duration for audio/video (seconds)
  readBy: string[]; // Array of userIds who read the message
  reactions: MessageReactions; // emoji -> [userId]
  replyTo: string | null; // messageId being replied to
  deleted: boolean; // Soft delete flag
  createdAt: string; // ISO timestamp (same as timestamp usually)
}

export type MessageType = "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "FILE";

export type MessageReactions = Record<string, string[]>; // emoji -> userIds

/**
 * Group
 * Table: PantherKolab-Groups-{env}
 * Primary Key: groupId
 */
export interface Group {
  groupId: string; // Same as conversationId for groups
  classCode: string | null; // Associated class code (e.g., "COP4520")
  semester: string | null; // Semester (e.g., "Fall 2025")
  isClassGroup: boolean; // Auto-created for classes
  tags: string[]; // Tags for discoverability
  settings: GroupSettings; // Group configuration
  memberCount: number; // Current member count
  createdAt: string;
  updatedAt: string;
}

export interface GroupSettings {
  isPublic: boolean; // Can anyone join?
  requireApproval: boolean; // Admin approval needed?
  maxMembers: number; // Member limit (0 = unlimited)
}

/**
 * Create User Input (for signup)
 */
export interface CreateUserInput {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Update User Input (partial update)
 */
export type UpdateUserInput = Partial<
  Omit<UserProfile, "userId" | "email" | "createdAt">
>;

/**
 * Create Conversation Input
 */
export interface CreateConversationInput {
  type: ConversationType;
  name?: string;
  description?: string;
  participants: string[];
  createdBy: string;
  avatar?: string;
}

/**
 * Create Message Input
 */
export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  replyTo?: string;
}

/**
 * Create Group Input
 */
export interface CreateGroupInput {
  conversationId: string; // Must match an existing conversation
  classCode?: string;
  semester?: string;
  isClassGroup?: boolean;
  tags?: string[];
  settings?: Partial<GroupSettings>;
}

/**
 * Database Table Names
 */
export const TABLE_NAMES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || "PantherKolab-Users-dev",
  CONVERSATIONS:
    process.env.DYNAMODB_CONVERSATIONS_TABLE ||
    "PantherKolab-Conversations-dev",
  MESSAGES: process.env.DYNAMODB_MESSAGES_TABLE || "PantherKolab-Messages-dev",
  GROUPS: process.env.DYNAMODB_GROUPS_TABLE || "PantherKolab-Groups-dev",
  CALLS: process.env.DYNAMODB_CALLS_TABLE || "PantherKolab-CallSessions-dev",
  WHITEBOARDS:
    process.env.DYNAMODB_WHITEBOARDS_TABLE || "PantherKolab-Whiteboards-dev",
} as const;

/**
 * Index Names
 */
export const INDEX_NAMES = {
  USERS: {
    EMAIL: "EmailIndex",
    MAJOR: "MajorIndex",
  },
  MESSAGES: {
    MESSAGE_ID: "MessageIdIndex",
  },
  GROUPS: {
    CLASS_CODE: "ClassCodeIndex",
  },
  WHITEBOARDS: {
    CONVERSATION_ID: "ConversationIdIndex",
  },
} as const;

/**
 * Call
 * Table: PantherKolab-CallSessions-{env}
 * Primary Key: sessionId (PK) + timestamp (SK)
 */
export interface Call {
  sessionId: string; // UUID - Partition key
  timestamp: string; // ISO timestamp - Sort key
  chimeMeetingId: string; // AWS Chime Meeting ID
  conversationId: string | null; // Conversation ID (null for direct calls)
  callType: CallType; // DIRECT or GROUP
  initiatedBy: string; // User ID who started the call
  participants: CallParticipant[]; // Array of call participants
  status: CallStatus; // Current call status
  startedAt: string | null; // ISO timestamp when call became active
  endedAt: string | null; // ISO timestamp when call ended
  createdAt: string; // ISO timestamp when call was created
  duration: number | null; // Call duration in seconds
}

/**
 * Call Participant
 */
export interface CallParticipant {
  userId: string; // User ID
  attendeeId: string | null; // AWS Chime Attendee ID
  joinedAt: string | null; // ISO timestamp when joined
  leftAt: string | null; // ISO timestamp when left
  status: "RINGING" | "JOINED" | "LEFT" | "REJECTED"; // Participant status
  becameCallOwner: {
    // Tracks if/when this participant became call owner
    status: boolean; // Whether this participant is currently the call owner
    timestamp: string | null; // ISO timestamp when they became owner (null if never)
  } | null;
}

/**
 * Call Types
 */
export type CallType = "DIRECT" | "GROUP";

/**
 * Call Status
 */
export type CallStatus =
  | "RINGING"
  | "ACTIVE"
  | "ENDED"
  | "MISSED"
  | "REJECTED"
  | "CANCELLED";

/**
 * Create Call Input
 */
export interface CreateCallInput {
  callType: CallType;
  initiatedBy: string;
  participantIds: string[];
  conversationId?: string;
}

/**
 * Incoming Call Data (Socket.IO event payload)
 */
export interface IncomingCallData {
  sessionId: string;
  callerId: string;
  callerName: string;
  callType: CallType;
  conversationId?: string | null;
}

/**
 * Whiteboard
 * Table: PantherKolab-Whiteboards-{env}
 * Primary Key: whiteboardId
 * GSI: ConversationIdIndex (conversationId)
 */
export interface Whiteboard {
  whiteboardId: string; // UUID - Partition key
  conversationId: string; // Associated conversation (indexed via GSI)
  name: string; // Whiteboard name
  createdBy: string; // Creator userId
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  snapshot: string | null; // tldraw snapshot JSON (serialized state)
  isActive: boolean; // Is whiteboard currently active
  participants: string[]; // Array of userIds currently viewing/editing
}

/**
 * Create Whiteboard Input
 */
export interface CreateWhiteboardInput {
  conversationId: string;
  name: string;
  createdBy: string;
}
