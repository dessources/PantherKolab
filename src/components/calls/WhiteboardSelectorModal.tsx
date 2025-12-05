"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Whiteboard {
  whiteboardId: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

interface WhiteboardSelectorModalProps {
  conversationId: string;
  onSelect: (whiteboardId: string) => void;
  onClose: () => void;
}

export function WhiteboardSelectorModal({
  conversationId,
  onSelect,
  onClose,
}: WhiteboardSelectorModalProps) {
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWhiteboards = async () => {
      try {
        const response = await fetch(
          `/api/whiteboards/list?conversationId=${conversationId}`
        );
        if (!response.ok) throw new Error("Failed to fetch whiteboards");
        const data = await response.json();
        setWhiteboards(data.whiteboards || []);
      } catch (error) {
        console.error("Error fetching whiteboards:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWhiteboards();
  }, [conversationId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Select Whiteboard
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading whiteboards...</p>
        ) : whiteboards.length === 0 ? (
          <p className="text-gray-500">
            No whiteboards found for this conversation.
          </p>
        ) : (
          <div className="space-y-2">
            {whiteboards.map((wb) => (
              <button
                key={wb.whiteboardId}
                onClick={() => onSelect(wb.whiteboardId)}
                className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">{wb.name}</p>
                <p className="text-sm text-gray-500">
                  Created {new Date(wb.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
