"use client"

import { PhoneOff, Users, Video } from 'lucide-react'

interface OutgoingCallModalProps {
  recipientName: string;
  callType: 'DIRECT' | 'GROUP';
  status: 'initiating' | 'ringing';
  onCancel: () => void;
}

export function OutgoingCallModal({
  recipientName,
  callType,
  status,
  onCancel,
}: OutgoingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        <div className="text-center">
          {/* Call Type Icon */}
          <div className="mb-6">
            {callType === 'GROUP' ? (
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-[#0066CC]" />
              </div>
            ) : (
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Video className="w-8 h-8 text-[#0066CC]" />
              </div>
            )}
          </div>

          {/* Recipient Avatar */}
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-[#003366] to-[#0066CC] flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg">
            {recipientName.charAt(0).toUpperCase()}
          </div>

          {/* Recipient Info */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{recipientName}</h2>
          <p className="text-gray-600 text-lg mb-2">
            {callType === 'GROUP' ? 'Group video call' : 'Video call'}
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500 capitalize">{status}...</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-6 justify-center">
            <button
              onClick={onCancel}
              className="group flex flex-col items-center gap-2"
              aria-label="Cancel call"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all shadow-lg hover:shadow-xl group-hover:scale-110">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-sm text-gray-600 font-medium">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
