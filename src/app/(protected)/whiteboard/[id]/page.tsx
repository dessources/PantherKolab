"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";
import { ExportDialog } from "@/components/whiteboard/ExportDialog";
import { Download } from "lucide-react";
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

  const isReadOnly = whiteboard.createdBy !== authUser.userId;
  console.log("isREadonly:", isReadOnly, whiteboard.createdBy, authUser.userId);
  return (
    <>
      <WhiteboardCanvas
        whiteboardId={whiteboardId}
        currentUserId={authUser.userId}
        initialSnapshot={whiteboard.snapshot || undefined}
        isReadonly={isReadOnly}
      >
        {showExportDialog && (
          <ExportDialog
            whiteboardId={whiteboardId}
            onClose={() => setShowExportDialog(false)}
          />
        )}
      </WhiteboardCanvas>

      {/* Responsive Export Button */}
      <button
        onClick={() => setShowExportDialog(true)}
        className="fixed bottom-5 right-5 z-[1000] flex items-center justify-center h-12 w-12 md:w-auto md:px-4 bg-[#FFB300] text-black rounded-full md:rounded-lg shadow-lg hover:bg-[#FFA000] transition-colors"
        aria-label="Export whiteboard"
      >
        <Download size={20} />
        <span className="hidden md:inline ml-2 font-semibold">Export</span>
      </button>
    </>
  );
}
