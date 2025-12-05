/**
 * useWhiteboard Hook
 *
 * Manages the state and real-time collaboration for a tldraw whiteboard.
 * - Subscribes to AppSync for real-time updates.
 * - Handles incoming events to update the editor state.
 * - Provides a debounced function to sync local changes to the backend.
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Editor, loadSnapshot } from "tldraw";
import { subscribeToUserWhiteboards } from "@/lib/appSync/appsync-client";
import {
  AppSyncEvent,
  WhiteboardEvent,
  WhiteboardUpdatedEvent,
} from "@/types/appsync-events";
import { logDebug } from "@/lib/utils";

interface UseWhiteboardOptions {
  whiteboardId: string | null;
  currentUserId: string;
  editor: Editor | null;
}

interface UseWhiteboardReturn {
  isConnected: boolean;
  activeUsers: string[]; // Placeholder for user IDs
  syncChanges: (snapshot: string) => void;
}

export function useWhiteboard({
  whiteboardId,
  currentUserId,
  editor,
}: UseWhiteboardOptions): UseWhiteboardReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to avoid stale closures in callbacks
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const whiteboardIdRef = useRef(whiteboardId);
  whiteboardIdRef.current = whiteboardId;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  /**
   * Handle incoming whiteboard events from AppSync subscription.
   */
  const handleWhiteboardEvent = useCallback((event: AppSyncEvent) => {
    logDebug("Received whiteboard event:", event.type, event.data);

    if (event.type === "WHITEBOARD_UPDATED") {
      const {
        whiteboardId: updatedId,
        snapshot,
        updatedBy,
      } = (event as WhiteboardUpdatedEvent).data;

      // Ignore if the event is for a different whiteboard or if it was sent by the current user
      if (
        updatedId !== whiteboardIdRef.current ||
        updatedBy === currentUserIdRef.current
      ) {
        return;
      }

      const editor = editorRef.current;
      if (editor && snapshot) {
        try {
          const snapshotData = JSON.parse(snapshot);
          // This replaces the content on the current page.
          // It's the primary way to sync remote changes.
          loadSnapshot(editor.store, snapshotData);

          logDebug(`Applied remote snapshot to whiteboard ${updatedId}`);
        } catch (e) {
          console.error("Failed to parse or apply remote snapshot", e);
        }
      }
    }

    // TODO: Handle other events like PARTICIPANT_JOINED, PARTICIPANT_LEFT, CURSOR_MOVED
    if (event.type === "WHITEBOARD_PARTICIPANT_JOINED") {
      // const { userId } = event.data;
      // setActiveUsers(prev => [...new Set([...prev, userId])]);
    }
    if (event.type === "WHITEBOARD_PARTICIPANT_LEFT") {
      // const { userId } = event.data;
      // setActiveUsers(prev => prev.filter(id => id !== userId));
    }
  }, []);

  /**
   * Subscribe to the user-centric whiteboard channel.
   */
  useEffect(() => {
    if (!currentUserId) return;

    const subscribe = async () => {
      try {
        subscriptionRef.current?.close();
        subscriptionRef.current = await subscribeToUserWhiteboards(
          currentUserId,
          handleWhiteboardEvent,
          (err) => {
            console.error("[useWhiteboard] Subscription error:", err);
            setError(err);
            setIsConnected(false);
          }
        );
        setIsConnected(true);
        logDebug(`[useWhiteboard] Subscribed to /whiteboards/${currentUserId}`);
      } catch (err) {
        console.error("[useWhiteboard] Failed to subscribe:", err);
        setError(err instanceof Error ? err : new Error("Subscription failed"));
        setIsConnected(false);
      }
    };

    subscribe();

    return () => {
      subscriptionRef.current?.close();
      subscriptionRef.current = null;
    };
  }, [currentUserId, handleWhiteboardEvent]);

  /**
   * Debounced function to send snapshot changes to the backend API.
   */
  const syncChanges = useCallback((snapshot: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!whiteboardIdRef.current) return;

      logDebug(`Syncing changes for whiteboard ${whiteboardIdRef.current}`);
      try {
        const response = await fetch("/api/whiteboards/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whiteboardId: whiteboardIdRef.current,
            snapshot,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to sync whiteboard changes");
        }
      } catch (err) {
        console.error("Error syncing whiteboard:", err);
        // Optionally set an error state to show in the UI
      }
    }, 200); // Debounce interval of 2 seconds
  }, []);

  return { isConnected, activeUsers, syncChanges };
}
