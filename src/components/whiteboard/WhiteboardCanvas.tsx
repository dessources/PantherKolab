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
import "tldraw/tldraw.css"; // Import tldraw styles

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
  isReadonly: boolean;
}

/**
 * A component that renders the tldraw editor and handles the real-time collaboration logic.
 */
function EditorWithSync({
  whiteboardId,
  currentUserId,
  initialSnapshot,
  isReadonly,
}: WhiteboardCanvasProps) {
  const editor = useEditor();
  const { syncChanges } = useWhiteboard({
    whiteboardId,
    currentUserId,
    editor,
    isReadonly,
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
  }, [currentUserId, editor, initialSnapshot, syncChanges]);

  return null; // This component no longer renders any UI itself
}

export function WhiteboardCanvas({
  ...props
}: WhiteboardCanvasProps & { children?: React.ReactNode }) {
  console.log("isREadonly:", props.isReadonly, props.currentUserId);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <TldrawComponent
        // Passing a unique key based on whiteboardId ensures that tldraw
        // remounts and gets a fresh state when switching between different whiteboards.
        key={props.whiteboardId}
        persistenceKey={`tldraw_${props.whiteboardId}`}
        autoFocus
        onMount={(editor) => {
          editor.updateInstanceState({ isReadonly: props.isReadonly });
        }}
        // readOnly ={props.isReadonly}
      >
        <EditorWithSync {...props} />
        {props.children}
      </TldrawComponent>
    </div>
  );
}
