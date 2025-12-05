"use client";

import {
  useEditor,
  Tldraw,
  TLStoreWithStatus,
  getSnapshot as toSnapshot,
} from "tldraw";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWhiteboard } from "@/hooks/useWhiteboard";

// Lazy load the Tldraw component to prevent SSR issues and reduce initial bundle size.
const TldrawComponent = dynamic(
  () => import("tldraw").then((mod) => mod.Tldraw),
  {
    ssr: false,
  }
);

interface WhiteboardCanvasProps {
  whiteboardId: string;
  currentUserId: string;
  initialSnapshot?: string;
  isReadOnly?: boolean;
}

/**
 * A component that renders the tldraw editor and handles the real-time collaboration logic.
 */
function EditorWithSync({
  whiteboardId,
  currentUserId,
  initialSnapshot,
  isReadOnly = false,
}: WhiteboardCanvasProps) {
  const editor = useEditor();
  const { isConnected, syncChanges } = useWhiteboard({
    whiteboardId,
    currentUserId,
    editor,
  });

  useEffect(() => {
    if (!editor) return;

    // Load the initial snapshot when the editor is ready
    if (initialSnapshot) {
      try {
        const snapshot = JSON.parse(initialSnapshot);
        editor.loadSnapshot(snapshot);
      } catch (e) {
        console.error("Failed to parse or load initial snapshot", e);
      }
    }

    // Listen for changes in the editor and sync them.
    const cleanup = editor.store.listen(
      (entry) => {
        // Only trigger sync on user actions, not on remote changes.
        if (entry.source !== "user") {
          return;
        }
        const snapshot = toSnapshot(editor.store);
        syncChanges(JSON.stringify(snapshot));
      },
      { source: "user", scope: "document" } // Only listen to document changes made by the user
    );

    return () => {
      cleanup();
    };
  }, [editor, initialSnapshot, syncChanges]);

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 999,
          padding: "4px 8px",
          borderRadius: "5px",
          backgroundColor: isConnected ? "#4CAF50" : "#F44336",
          color: "white",
          fontSize: "12px",
        }}
      >
        {isConnected ? "Connected" : "Disconnected"}
      </div>
    </>
  );
}

export function WhiteboardCanvas(
  props: WhiteboardCanvasProps & { children?: React.ReactNode }
) {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <TldrawComponent
        // Passing a unique key based on whiteboardId ensures that tldraw
        // remounts and gets a fresh state when switching between different whiteboards.
        key={props.whiteboardId}
        persistenceKey={`tldraw_${props.whiteboardId}`}
        autoFocus
        // readOnly={props.isReadOnly}
      >
        <EditorWithSync {...props} />
        {props.children}
      </TldrawComponent>
    </div>
  );
}
