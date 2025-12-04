/**
 * useMessages Hook
 *
 * Custom hook for managing messages with real-time updates via AppSync.
 * Handles:
 * - Loading message history from API (once per conversation)
 * - Subscribing to real-time messages AND typing via AppSync /chats/{userId}
 * - Persisting messages in memory across conversation switches
 * - Sending messages with optimistic updates
 * - Typing indicators
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { subscribeToUserMessages } from "@/lib/appSync/appsync-client";
import type { Message } from "@/types/database";
import type {
  MessageSentEvent,
  UserTypingEvent,
  UserStoppedTypingEvent,
} from "@/types/appsync-events";

interface UseMessagesOptions {
  conversationId: string | null;
  currentUserId: string;
}

interface TypingUser {
  userId: string;
  conversationId: string;
  timestamp: number;
}

interface UseMessagesReturn {
  messages: Message[];
  typingUsers: TypingUser[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  sendMessage: (
    content: string,
    type?: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "FILE"
  ) => Promise<void>;
  startTyping: () => Promise<void>;
  stopTyping: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

// In-memory cache for messages across conversation switches
// This persists messages so they don't need to be re-fetched
const messageCache = new Map<string, Message[]>();
const fetchedConversations = new Set<string>();

// Helper to sort messages chronologically
const sortMessages = (messages: Message[]) => {
  return messages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

/**
 * Hook to manage messages for a conversation with AppSync real-time
 *
 * @param conversationId - The ID of the conversation (null if none selected)
 * @param currentUserId - The current user's ID for subscriptions
 * @returns Messages, typing users, loading state, error, and actions
 *
 * @example
 * ```tsx
 * const { messages, typingUsers, loading, sendMessage } = useMessages({
 *   conversationId: "conv-123",
 *   currentUserId: "user-1"
 * });
 * ```
 */
export function useMessages({
  conversationId,
  currentUserId,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Track pending optimistic messages
  const optimisticMessageIds = useRef<Set<string>>(new Set());
  // Track typing timeouts for auto-clearing
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track subscription
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  // Store conversationId in ref to avoid stale closures
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  /**
   * Fetch message history from API (only if not already fetched)
   */
  const fetchMessages = useCallback(
    async (forceRefresh = false) => {
      if (!conversationId || conversationId.startsWith("temp-")) {
        setMessages([]);
        return;
      }

      // Check cache first (unless force refresh)
      if (!forceRefresh && fetchedConversations.has(conversationId)) {
        const cached = messageCache.get(conversationId) || [];
        setMessages(sortMessages(cached)); // Ensure cache is sorted on retrieval
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/messages/${conversationId}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.statusText}`);
        }

        const data = await response.json();
        const fetchedMessages: Message[] = Array.isArray(data.messages)
          ? data.messages
          : Array.isArray(data)
          ? data
          : [];
        
        const sorted = sortMessages(fetchedMessages);

        // Update cache
        messageCache.set(conversationId, sorted);
        fetchedConversations.add(conversationId);

        setMessages(sorted);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to load messages");
        setError(error);
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  /**
   * Handle incoming chat events (messages + typing)
   */
  const handleChatEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      // Handle message events
      if (event.type === "MESSAGE_SENT") {
        const messageEvent = event as MessageSentEvent;
        const newMessage = messageEvent.data as unknown as Message;

        // Update cache for this conversation
        const convId = newMessage.conversationId;
        const cached = messageCache.get(convId) || [];

        // Check for duplicate or optimistic update replacement
        const tempId = (messageEvent.data as { tempId?: string }).tempId;
        const existingIndex = cached.findIndex(
          (m) =>
            m.messageId === newMessage.messageId ||
            (tempId && m.messageId === tempId)
        );

        let newCache: Message[];
        if (existingIndex >= 0) {
          // Replace optimistic message with real one
          const oldId = cached[existingIndex].messageId;
          cached[existingIndex] = newMessage;
          optimisticMessageIds.current.delete(oldId);
          newCache = [...cached];
        } else {
          newCache = [...cached, newMessage];
        }

        const sortedCache = sortMessages(newCache);
        messageCache.set(convId, sortedCache);

        // Update state if this is the current conversation
        if (convId === conversationIdRef.current) {
          setMessages(sortedCache);
        }
      }

      // Handle typing events
      if (
        event.type === "USER_TYPING" ||
        event.type === "USER_STOPPED_TYPING"
      ) {
        const typingEvent = event as UserTypingEvent | UserStoppedTypingEvent;
        const { userId: typingUserId, conversationId: typingConvId } =
          typingEvent.data;

        if (event.type === "USER_TYPING") {
          setTypingUsers((prev) => {
            const existing = prev.find(
              (u) =>
                u.userId === typingUserId && u.conversationId === typingConvId
            );
            if (existing) {
              return prev.map((u) =>
                u.userId === typingUserId && u.conversationId === typingConvId
                  ? { ...u, timestamp: Date.now() }
                  : u
              );
            }
            return [
              ...prev,
              {
                userId: typingUserId,
                conversationId: typingConvId,
                timestamp: Date.now(),
              },
            ];
          });

          // Clear after 3 seconds if no update
          const key = `${typingUserId}-${typingConvId}`;
          const existingTimeout = typingTimeoutRef.current.get(key);
          if (existingTimeout) clearTimeout(existingTimeout);

          typingTimeoutRef.current.set(
            key,
            setTimeout(() => {
              setTypingUsers((prev) =>
                prev.filter(
                  (u) =>
                    !(
                      u.userId === typingUserId &&
                      u.conversationId === typingConvId
                    )
                )
              );
            }, 3000)
          );
        } else {
          // USER_STOPPED_TYPING
          setTypingUsers((prev) =>
            prev.filter(
              (u) =>
                !(
                  u.userId === typingUserId && u.conversationId === typingConvId
                )
            )
          );
          const key = `${typingUserId}-${typingConvId}`;
          const timeout = typingTimeoutRef.current.get(key);
          if (timeout) clearTimeout(timeout);
        }
      }
    },
    []
  );

  /**
   * Subscribe to AppSync /chats/{userId} channel
   * This is a single subscription that handles ALL conversations
   */
  useEffect(() => {
    if (!currentUserId) return;

    const subscribe = async () => {
      try {
        // Close existing subscription if any
        subscriptionRef.current?.close();

        // Subscribe to user's chat channel
        subscriptionRef.current = await subscribeToUserMessages(
          currentUserId,
          handleChatEvent,
          (err) => {
            console.error("[useMessages] Subscription error:", err);
            setError(err);
            setIsConnected(false);
          }
        );

        setIsConnected(true);
        console.log(`[useMessages] Subscribed to /chats/${currentUserId}`);
      } catch (err) {
        console.error("[useMessages] Failed to subscribe:", err);
        setError(
          err instanceof Error ? err : new Error("Subscription failed")
        );
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      subscriptionRef.current?.close();
      subscriptionRef.current = null;
    };
  }, [currentUserId, handleChatEvent]);

  /**
   * Load messages when conversation changes
   */
  useEffect(() => {
    if (conversationId) {
      // Load from cache or fetch
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId, fetchMessages]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(
    async (
      content: string,
      type: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "FILE" = "TEXT"
    ) => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }

      if (!currentUserId) {
        throw new Error("Current user ID not provided");
      }

      if (!content.trim()) {
        return;
      }

      // Create optimistic message
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const optimisticMessage: Message = {
        conversationId,
        timestamp: new Date().toISOString(),
        messageId: tempId,
        senderId: currentUserId,
        type,
        content: content.trim(),
        mediaUrl: null,
        fileName: null,
        fileSize: null,
        duration: null,
        readBy: [],
        reactions: {},
        replyTo: null,
        deleted: false,
        createdAt: new Date().toISOString(),
      };

      // Add to cache and state immediately
      const cached = messageCache.get(conversationId) || [];
      const newCache = sortMessages([...cached, optimisticMessage]);
      
      messageCache.set(conversationId, newCache);
      setMessages(newCache);
      optimisticMessageIds.current.add(tempId);

      try {
        const response = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversationId,
            content: content.trim(),
            type,
            tempId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Real message will arrive via AppSync subscription
      } catch (err) {
        // Remove optimistic message on error
        const cached = messageCache.get(conversationId) || [];
        const filtered = cached.filter((m) => m.messageId !== tempId);
        messageCache.set(conversationId, filtered);
        setMessages(filtered); // Already sorted, no need to re-sort on removal
        optimisticMessageIds.current.delete(tempId);

        const error =
          err instanceof Error ? err : new Error("Failed to send message");
        setError(error);
        throw error;
      }
    },
    [conversationId, currentUserId]
  );

  /**
   * Send typing indicator
   */
  const startTyping = useCallback(async () => {
    if (!conversationId) return;

    try {
      await fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, isTyping: true }),
      });
    } catch (err) {
      console.error("Failed to send typing indicator:", err);
    }
  }, [conversationId]);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(async () => {
    if (!conversationId) return;

    try {
      await fetch("/api/messages/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, isTyping: false }),
      });
    } catch (err) {
      console.error("Failed to send stop typing indicator:", err);
    }
  }, [conversationId]);

  /**
   * Force refresh messages from API
   */
  const refreshMessages = useCallback(async () => {
    await fetchMessages(true);
  }, [fetchMessages]);

  // Cleanup on unmount
  useEffect(() => {
    const timeoutMap = typingTimeoutRef.current;
    return () => {
      timeoutMap.forEach((timeout) => clearTimeout(timeout));
      timeoutMap.clear();
    };
  }, []);

  return {
    messages,
    typingUsers: typingUsers.filter((u) => u.conversationId === conversationId),
    loading,
    error,
    isConnected,
    sendMessage,
    startTyping,
    stopTyping,
    refreshMessages,
  };
}

export default useMessages;