/**
 * Mock ChatWindow Component
 *
 * Temporary component for testing message transfer functionality
 * Will be replaced by frontend team's implementation
 *
 * Combines MessageList and MessageInput into a complete chat interface
 */

'use client';

import { MessageList, type MockMessage } from './MessageList';
import { MessageInput } from './MessageInput';
import { SummaryButton } from '@/components/SummaryButton';

interface ChatWindowProps {
  conversationId: string | null;
  conversationName: string;
  messages: MockMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  memberCount?: number;
}

export function ChatWindow({
  conversationId,
  conversationName,
  messages,
  currentUserId,
  onSendMessage,
  isLoading = false,
  memberCount = 0,
}: ChatWindowProps) {
  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-6xl mb-4">💬</p>
          <h2 className="text-2xl font-bold mb-2">PantherKolab Messages</h2>
          <p className="text-lg">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  const initials = conversationName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 3);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{conversationName}</h2>
              <p className="text-xs text-gray-600">{memberCount} members</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Voice call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                />
              </svg>
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Search messages"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="More options"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Loading messages...
          </p>
        </div>
      )}

      {/* AI Summary Button */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <SummaryButton
          conversationId={conversationId}
          onSummaryGenerated={(summary) => {
            console.log('AI Summary generated:', summary);
          }}
        />
      </div>

      {/* Messages */}
      <MessageList messages={messages} currentUserId={currentUserId} />

      {/* Input */}
      <MessageInput onSendMessage={onSendMessage} disabled={isLoading} />
    </div>
  );
}
