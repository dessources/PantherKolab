/**
 * Socket.IO Utility Functions
 * Helpers for call session management and user lookup
 */

import { Server, Socket } from "socket.io";
import { CallSessionState } from "@/types/socketEvents";

/**
 * In-memory storage for active call sessions
 * Map: sessionId -> CallSessionState
 */
export const activeCalls = new Map<string, CallSessionState>();

/**
 * User-to-Socket mapping for quick lookups
 * Map: userId -> socketId
 */
export const userSocketMap = new Map<string, string>();

/**
 * Socket-to-User mapping for cleanup
 * Map: socketId -> userId
 */
export const socketUserMap = new Map<string, string>();

/**
 * Get socket ID for a user
 */
export function getSocketIdForUser(userId: string): string | undefined {
  return userSocketMap.get(userId);
}

/**
 * Get user ID for a socket
 */
export function getUserIdForSocket(socketId: string): string | undefined {
  return socketUserMap.get(socketId);
}

/**
 * Register user-socket mapping
 */
export function registerUserSocket(userId: string, socketId: string): void {
  userSocketMap.set(userId, socketId);
  socketUserMap.set(socketId, userId);
}

/**
 * Unregister user-socket mapping and cleanup
 */
export function unregisterUserSocket(socketId: string): void {
  const userId = socketUserMap.get(socketId);
  if (userId) {
    userSocketMap.delete(userId);
  }
  socketUserMap.delete(socketId);
}

/**
 * Store call session in memory
 */
export function storeCallSession(session: CallSessionState): void {
  activeCalls.set(session.sessionId, session);
}

/**
 * Get call session by ID
 */
export function getCallSession(
  sessionId: string
): CallSessionState | undefined {
  return activeCalls.get(sessionId);
}

/**
 * Remove call session from memory
 */
export function removeCallSession(sessionId: string): void {
  activeCalls.delete(sessionId);
}

/**
 * Update participant socket mapping in a call
 */
export function addParticipantToCall(
  sessionId: string,
  userId: string,
  socketId: string
): boolean {
  const session = activeCalls.get(sessionId);
  if (!session) {
    return false;
  }

  session.participantSocketMap.set(userId, socketId);
  return true;
}

/**
 * Remove participant from call
 */
export function removeParticipantFromCall(
  sessionId: string,
  userId: string
): boolean {
  const session = activeCalls.get(sessionId);
  if (!session) {
    return false;
  }

  session.participantSocketMap.delete(userId);
  return true;
}

/**
 * Get all participants in a call (socket IDs)
 */
export function getCallParticipantSockets(sessionId: string): string[] {
  const session = activeCalls.get(sessionId);
  if (!session) {
    return [];
  }

  return Array.from(session.participantSocketMap.values());
}

/**
 * Get all participant user IDs in a call
 */
export function getCallParticipantIds(sessionId: string): string[] {
  const session = activeCalls.get(sessionId);
  if (!session) {
    return [];
  }

  return Array.from(session.participantSocketMap.keys());
}

/**
 * Check if user is in a call
 */
export function isUserInCall(userId: string): string | undefined {
  for (const [sessionId, session] of activeCalls.entries()) {
    if (session.participantSocketMap.has(userId)) {
      return sessionId;
    }
  }
  return undefined;
}

/**
 * Broadcast event to all participants in a call
 */
export function broadcastToCallParticipants(
  io: Server,
  sessionId: string,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  excludeSocketId?: string
): void {
  const socketIds = getCallParticipantSockets(sessionId);

  socketIds.forEach((socketId) => {
    if (excludeSocketId && socketId === excludeSocketId) {
      return;
    }

    io.to(socketId).emit(event, data);
  });
}

/**
 * Emit event to specific user
 */

export function emitToUser(
  io: Server,
  userId: string,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): boolean {
  const socketId = getSocketIdForUser(userId);
  if (!socketId) {
    return false;
  }

  io.to(socketId).emit(event, data);
  return true;
}

/**
 * Clean up user on disconnect
 */
export function cleanupUserOnDisconnect(socket: Socket): void {
  const userId = getUserIdForSocket(socket.id);

  if (userId) {
    // Check if user is in active call
    const sessionId = isUserInCall(userId);
    if (sessionId) {
      removeParticipantFromCall(sessionId, userId);

      // If no more participants, end the call
      const callParticipants = getCallParticipantIds(sessionId);
      if (callParticipants.length === 0) {
        removeCallSession(sessionId);
      }
    }

    unregisterUserSocket(socket.id);
  }
}

/**
 * Generate timestamp for events
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}
