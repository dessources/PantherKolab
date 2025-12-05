"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";
import { ExportDialog } from "@/components/whiteboard/ExportDialog";
import { Whiteboard } from "@/types/database";
import { useAuth } from "@/components/contexts/AuthContext"; // Assuming an AuthContext exists

export default function WhiteboardPage() {
  const params = useParams();
  const { user: authUser } = useAuth(); // Assuming useAuth hook provides the user object
  const whiteboardId = params.id as string;

  const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    if (!whiteboardId || !authUser) return;

    const fetchWhiteboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/whiteboards/${whiteboardId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to fetch whiteboard: ${response.statusText}`
          );
        }
        const data = await response.json();
        setWhiteboard(data.whiteboard);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWhiteboard();
  }, [whiteboardId, authUser]);

  if (loading) {
    return <div>Loading whiteboard...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  if (!whiteboard || !authUser) {
    return <div>Whiteboard not found or user not authenticated.</div>;
  }

  return (
    <>
      <WhiteboardCanvas
        whiteboardId={whiteboardId}
        currentUserId={authUser.userId} // Assuming username is the ID
        initialSnapshot={whiteboard.snapshot || undefined}
      >
        {showExportDialog && (
          <ExportDialog
            whiteboardId={whiteboardId}
            onClose={() => setShowExportDialog(false)}
          />
        )}
      </WhiteboardCanvas>

      {/* Button to trigger the export dialog */}
      <button
        onClick={() => setShowExportDialog(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '10px 20px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#0066CC',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Export
      </button>
    </>
  );
}
