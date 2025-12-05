"use client";

import { WhiteboardCanvas } from "@/components/whiteboard/WhiteboardCanvas";
import { X } from "lucide-react";

interface WhiteboardInCallViewProps {
  whiteboardId: string;
  currentUserId: string;
  initialSnapshot: string | null;
  isCreator: boolean;
  onClose: () => void;
}

export function WhiteboardInCallView({
  whiteboardId,
  currentUserId,
  initialSnapshot,
  isCreator,
  onClose,
}: WhiteboardInCallViewProps) {
  return (
    <div className="h-[80%] bg-gray-100 flex flex-col">
      {/* Whiteboard Header */}
      <div className="flex items-center justify-between px-4 md:px-8 lg:px-16 xl:px-24 py-3 bg-white border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          Collaborative Whiteboard
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close whiteboard"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Whiteboard Canvas */}
      <div className="flex-1 px-4 md:px-8 lg:px-16 xl:px-24 py-4">
        <div className="w-full h-full max-w-7xl mx-auto">
          <WhiteboardCanvas
            whiteboardId={whiteboardId}
            currentUserId={currentUserId}
            initialSnapshot={initialSnapshot || undefined}
            isReadonly={!isCreator}
          />
        </div>
      </div>
    </div>
  );
}
