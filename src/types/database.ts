// Database Models for PantherKolab DynamoDB Tables

import { UserProfile } from "./UserProfile"


export type AcademicYear = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate'

/**
 * Conversation
 * Table: PantherKolab-Conversations-{env}
 * Primary Key: conversationId
 */
export interface Conversation {
  conversationId: string     // UUID - Partition key
  type: ConversationType     // DM or GROUP
  name: string | null        // Group name (null for DMs)
  description: string | null // Group description
  participants: string[]     // Array of userIds
  admins: string[]          // Array of admin userIds (for groups)
  createdBy: string         // Creator userId
  createdAt: string         // ISO timestamp
  updatedAt: string         // ISO timestamp
  lastMessageAt: string     // ISO timestamp for sorting
  avatar: string | null     // S3 URL for group avatar
}

export type ConversationType = 'DM' | 'GROUP'

/**
 * Message
 * Table: PantherKolab-Messages-{env}
 * Primary Key: conversationId (PK) + timestamp (SK)
 */
export interface Message {
  conversationId: string    // Partition key
  timestamp: string        // Sort key (ISO timestamp)
  messageId: string        // UUID
  senderId: string         // User ID who sent the message
  type: MessageType        // Message content type
  content: string | null   // Text content (for text messages)
  mediaUrl: string | null  // S3 URL for media files
  fileName: string | null  // Original file name
  fileSize: number | null  // File size in bytes
  duration: number | null  // Duration for audio/video (seconds)
  readBy: string[]         // Array of userIds who read the message
  reactions: MessageReactions // emoji -> [userId]
  replyTo: string | null   // messageId being replied to
  deleted: boolean         // Soft delete flag
  createdAt: string        // ISO timestamp (same as timestamp usually)
}

export type MessageType = 'TEXT' | 'AUDIO' | 'IMAGE' | 'VIDEO' | 'FILE'

export type MessageReactions = Record<string, string[]> // emoji -> userIds

/**
 * Group
 * Table: PantherKolab-Groups-{env}
 * Primary Key: groupId
 */
export interface Group {
  groupId: string           // Same as conversationId for groups
  classCode: string | null  // Associated class code (e.g., "COP4520")
  semester: string | null   // Semester (e.g., "Fall 2025")
  isClassGroup: boolean     // Auto-created for classes
  tags: string[]            // Tags for discoverability
  settings: GroupSettings   // Group configuration
  memberCount: number       // Current member count
  createdAt: string
  updatedAt: string
}

export interface GroupSettings {
  isPublic: boolean         // Can anyone join?
  requireApproval: boolean  // Admin approval needed?
  maxMembers: number        // Member limit (0 = unlimited)
}

/**
 * Create User Input (for signup)
 */
export interface CreateUserInput {
  userId: string
  email: string
  firstName: string
  lastName: string
}

/**
 * Update User Input (partial update)
 */
export type UpdateUserInput = Partial<Omit<UserProfile, 'userId' | 'email' | 'createdAt'>>

/**
 * Create Conversation Input
 */
export interface CreateConversationInput {
  type: ConversationType
  name?: string
  description?: string
  participants: string[]
  createdBy: string
  avatar?: string
}

/**
 * Create Message Input
 */
export interface CreateMessageInput {
  conversationId: string
  senderId: string
  type: MessageType
  content?: string
  mediaUrl?: string
  fileName?: string
  fileSize?: number
  duration?: number
  replyTo?: string
}

/**
 * Create Group Input
 */
export interface CreateGroupInput {
  conversationId: string  // Must match an existing conversation
  classCode?: string
  semester?: string
  isClassGroup?: boolean
  tags?: string[]
  settings?: Partial<GroupSettings>
}

/**
 * Meeting (Chime)
 * Table: PantherKolab-Meetings-{env}
 * Primary Key: meetingId
 * For scheduled virtual meetings
 */
export interface Meeting {
  meetingId: string              // UUID - Partition key
  chimeMeetingId: string | null  // Chime SDK meeting ID (set when meeting starts)
  title: string                  // Meeting title
  description: string | null     // Meeting description
  creatorId: string              // User who created the meeting
  scheduledTime: string          // ISO timestamp - Sort key in CreatorIndex
  startTime: string | null       // Actual start time
  endTime: string | null         // Actual end time
  duration: number | null        // Duration in seconds
  status: MeetingStatus          // Current status
  accessType: MeetingAccessType  // Public vs restricted access
  invitedUserIds: string[]       // List of invited users (empty if public)
  conversationId: string | null  // Associated conversation (if any)
  maxAttendees: number           // Maximum number of attendees
  settings: MeetingSettings      // Meeting configuration
  createdAt: string              // ISO timestamp
  updatedAt: string              // ISO timestamp
}

export type MeetingStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED'
export type MeetingAccessType = 'PUBLIC' | 'RESTRICTED' | 'CONVERSATION'

export interface MeetingSettings {
  allowCamera: boolean           // Allow video
  allowMicrophone: boolean       // Allow audio
  allowScreenShare: boolean      // Allow screen sharing
  recordingEnabled: boolean      // Enable recording
  waitingRoomEnabled: boolean    // Enable waiting room for restricted meetings
}

/**
 * Call Session (Chime)
 * Table: PantherKolab-CallSessions-{env}
 * Primary Key: sessionId (PK) + timestamp (SK)
 * For direct 1-on-1 and group calls
 */
export interface CallSession {
  sessionId: string              // UUID - Partition key
  timestamp: string              // ISO timestamp - Sort key
  chimeMeetingId: string         // Chime SDK meeting ID
  callType: CallType             // Direct or group call
  conversationId: string         // Associated conversation
  initiatorId: string            // User who started the call
  participants: CallParticipant[] // All participants
  status: CallStatus             // Current status
  startedAt: string              // When call started
  endedAt: string | null         // When call ended
  duration: number | null        // Duration in seconds
  endReason: CallEndReason | null // Why call ended
  createdAt: string              // ISO timestamp
}

export type CallType = 'DIRECT' | 'GROUP'
export type CallStatus = 'RINGING' | 'ACTIVE' | 'ENDED' | 'MISSED' | 'DECLINED' | 'FAILED'
export type CallEndReason = 'COMPLETED' | 'DECLINED' | 'MISSED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'

export interface CallParticipant {
  userId: string                 // Participant user ID
  joinedAt: string | null        // When they joined
  leftAt: string | null          // When they left
  status: ParticipantStatus      // Current status
  chimeAttendeeId: string | null // Chime attendee ID
}

export type ParticipantStatus = 'INVITED' | 'RINGING' | 'JOINED' | 'LEFT' | 'DECLINED'

/**
 * Meeting Invite (Chime)
 * Table: PantherKolab-MeetingInvites-{env}
 * Primary Key: inviteId
 * For managing meeting invitations
 */
export interface MeetingInvite {
  inviteId: string               // UUID - Partition key
  meetingId: string              // Meeting being invited to
  inviteeId: string              // User being invited
  invitedBy: string              // User who sent invite
  status: InviteStatus           // Current status
  sentAt: string                 // ISO timestamp
  respondedAt: string | null     // When user responded
  message: string | null         // Optional invitation message
  createdAt: string              // ISO timestamp
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'

/**
 * Meeting Attendee (Chime)
 * Table: PantherKolab-MeetingAttendees-{env}
 * Primary Key: attendeeId
 * For tracking who joined meetings
 */
export interface MeetingAttendee {
  attendeeId: string             // UUID - Partition key
  meetingId: string              // Meeting attended
  userId: string                 // User who attended
  chimeAttendeeId: string        // Chime SDK attendee ID
  joinedAt: string               // When they joined
  leftAt: string | null          // When they left
  duration: number | null        // Duration in seconds
  wasInvited: boolean            // Whether they were invited
  createdAt: string              // ISO timestamp
}

/**
 * Create Meeting Input
 */
export interface CreateMeetingInput {
  title: string
  description?: string
  creatorId: string
  scheduledTime: string
  accessType: MeetingAccessType
  invitedUserIds?: string[]
  conversationId?: string
  maxAttendees?: number
  settings?: Partial<MeetingSettings>
}

/**
 * Create Call Session Input
 */
export interface CreateCallSessionInput {
  callType: CallType
  conversationId: string
  initiatorId: string
  participantIds: string[]
}

/**
 * Database Table Names
 */
export const TABLE_NAMES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'PantherKolab-Users-dev',
  CONVERSATIONS: process.env.DYNAMODB_CONVERSATIONS_TABLE || 'PantherKolab-Conversations-dev',
  MESSAGES: process.env.DYNAMODB_MESSAGES_TABLE || 'PantherKolab-Messages-dev',
  GROUPS: process.env.DYNAMODB_GROUPS_TABLE || 'PantherKolab-Groups-dev',
  MEETINGS: process.env.DYNAMODB_MEETINGS_TABLE || 'PantherKolab-Meetings-dev',
  CALL_SESSIONS: process.env.DYNAMODB_CALL_SESSIONS_TABLE || 'PantherKolab-CallSessions-dev',
  MEETING_INVITES: process.env.DYNAMODB_MEETING_INVITES_TABLE || 'PantherKolab-MeetingInvites-dev',
  MEETING_ATTENDEES: process.env.DYNAMODB_MEETING_ATTENDEES_TABLE || 'PantherKolab-MeetingAttendees-dev',
} as const

/**
 * Index Names
 */
export const INDEX_NAMES = {
  USERS: {
    EMAIL: 'EmailIndex',
    MAJOR: 'MajorIndex',
  },
  MESSAGES: {
    MESSAGE_ID: 'MessageIdIndex',
  },
  GROUPS: {
    CLASS_CODE: 'ClassCodeIndex',
  },
  MEETINGS: {
    CREATOR: 'CreatorIndex',
  },
  CALL_SESSIONS: {
    PARTICIPANT: 'ParticipantIndex',
  },
  MEETING_INVITES: {
    MEETING: 'MeetingIndex',
    INVITEE: 'InviteeIndex',
  },
  MEETING_ATTENDEES: {
    MEETING: 'MeetingIndex',
    USER: 'UserIndex',
  },
} as const
