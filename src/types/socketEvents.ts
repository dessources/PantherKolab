/**
 * Socket.IO Event Types for Call Notifications
 * Defines payloads for real-time call signaling events
 */

/**
 * Payload from client to initiate a call (DIRECT or GROUP)
 * Sent from initiator to server
 */
export interface CallInitiatePayload {
  sessionId: string
  callType: 'DIRECT' | 'GROUP'
  participantIds: string[]
  meetingInfo: {
    chimeMeetingId?: string
    mediaPlacement?: Record<string, unknown>
  }
}

/**
 * Payload for incoming call notification sent to recipient(s)
 * Server broadcasts this when call is initiated
 */
export interface CallIncomingPayload {
  sessionId: string
  initiatorId: string
  callType: 'DIRECT' | 'GROUP'
  participantIds: string[]
  meetingInfo: {
    chimeMeetingId?: string
    mediaPlacement?: Record<string, unknown>
  }
  timestamp: string
}

/**
 * Payload for call action events (accept/decline/end)
 * Minimal payload with user info - state is in DynamoDB
 */
export interface CallActionPayload {
  sessionId: string
  userId: string
  timestamp: string
}

/**
 * Socket.IO Error Response
 */
export interface SocketErrorResponse {
  success: false
  code: string
  message: string
  timestamp: string
}

/**
 * Socket.IO Success Response
 */
export interface SocketSuccessResponse {
  success: true
  message: string
  timestamp: string
}

/**
 * Complete Call Session for Socket.IO
 * Sent to clients when they join a call
 */
export interface CallSessionPayload {
  sessionId: string
  timestamp: string
  callType: 'DIRECT' | 'GROUP'
  initiatorId: string
  participants: {
    userId: string
    status: 'RINGING' | 'JOINED' | 'LEFT' | 'DECLINED'
  }[]
  status: 'RINGING' | 'ACTIVE' | 'ENDED'
}

/**
 * Socket.IO Event Names
 * Client → Server events
 */
export const CLIENT_EVENTS = {
  CALL_INITIATE: 'call:initiate',
  CALL_ACCEPT: 'call:accept',
  CALL_DECLINE: 'call:decline',
  CALL_END: 'call:end',
} as const

/**
 * Socket.IO Event Names
 * Server → Client events
 */
export const SERVER_EVENTS = {
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPTED: 'call:accepted',
  CALL_DECLINED: 'call:declined',
  CALL_ENDED: 'call:ended',
  CALL_ERROR: 'call:error',
} as const

/**
 * Socket.IO Acknowledgment Callbacks
 */
export type AckCallback = (response: SocketSuccessResponse | SocketErrorResponse) => void

/**
 * Call initiation payload from client
 */
export interface InitiateCallPayload {
  callType: 'DIRECT' | 'GROUP'
  participantIds: string[]
  conversationId?: string
}

/**
 * In-memory call session for server tracking
 */
export interface CallSessionState {
  sessionId: string
  initiatorId: string
  initiatorSocketId: string
  recipientIds: string[]
  participantSocketMap: Map<string, string> // userId -> socketId
  meetingInfo: {
    chimeMeetingId?: string
    mediaPlacement?: Record<string, unknown>
  }
  startedAt: string
  status: 'RINGING' | 'ACTIVE' | 'ENDED'
}