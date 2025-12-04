"use client";

interface CallControlPanelProps {
  isConnected: boolean;
  isRinging: boolean;
  localUserId: string;
  callType: "DIRECT" | "GROUP";
  recipientId: string;
  onCallTypeChange: (type: "DIRECT" | "GROUP") => void;
  onRecipientIdChange: (id: string) => void;
  onInitiateCall: () => void;
  onCancelCall: () => void;
}

/**
 * CallControlPanel - UI for initiating and managing calls
 * Separated component for clean code organization
 */
export function CallControlPanel({
  isConnected,
  isRinging,
  localUserId,
  callType,
  recipientId,
  onCallTypeChange,
  onRecipientIdChange,
  onInitiateCall,
  onCancelCall,
}: CallControlPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900">
        Start a Call
      </h2>

      {/* Connection Status */}
      <div className="mb-6 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-sm text-gray-600">
          {isConnected ? "Connected to AppSync" : "Disconnected"}
        </span>
      </div>

      <div className="space-y-6">
        {/* Call Initiation */}
        <div>
          <h3 className="font-semibold text-lg mb-4 text-gray-800">
            {`Your User ID: ${localUserId || "Not logged in"}`}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter a user ID to call. Uses AppSync Events for real-time
            signaling.
          </p>
          <div className="flex gap-4 items-center flex-wrap">
            <select
              value={callType}
              onChange={(e) =>
                onCallTypeChange(e.target.value as "DIRECT" | "GROUP")
              }
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            >
              <option value="DIRECT">Direct Call</option>
              <option value="GROUP">Group Call</option>
            </select>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Recipient ID:
              </label>
              <input
                type="text"
                value={recipientId}
                onChange={(e) => onRecipientIdChange(e.target.value)}
                placeholder="Enter user ID"
                className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
              />
            </div>
            {isRinging ? (
              <button
                onClick={onCancelCall}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Cancel Call
              </button>
            ) : (
              <button
                onClick={onInitiateCall}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isConnected || !localUserId}
              >
                Start Call
              </button>
            )}
          </div>
          {isRinging && (
            <p className="mt-2 text-sm text-yellow-600 animate-pulse">
              Ringing...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
