'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { UserProfilePanel } from './UserProfilePanel';

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  senderName?: string;
  senderAvatar?: string;
}

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio?: string;
  major?: string;
  year?: string;
  email?: string;
  phone?: string;
  interests?: string[];
}

interface ChatWindowWithProfileProps {
  currentUserId: string;
  otherUser: User;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export function ChatWindowWithProfile({
  currentUserId,
  otherUser,
  messages,
  onSendMessage,
}: ChatWindowWithProfileProps) {
  const [showProfile, setShowProfile] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <ChatHeader
          user={otherUser}
          showProfile={showProfile}
          onToggleProfile={() => setShowProfile(!showProfile)}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FAFBFC]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-[#F8F9FA] rounded-full flex items-center justify-center mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#003366"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-lg font-bold font-['Bitter'] text-[#003366] mb-2">
                No messages yet
              </p>
              <p className="text-sm font-['Bitter'] text-gray-500">
                Start the conversation with {otherUser.name}
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isOwnMessage={message.senderId === currentUserId}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-end gap-3">
            {/* Attachment Button */}
            <button
              className="p-2 text-gray-500 hover:text-[#003366] transition-colors flex-shrink-0"
              aria-label="Attach file"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-[#F8F9FA] rounded-lg border border-gray-200 text-sm font-['Bitter'] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#003366] resize-none"
                rows={1}
                style={{
                  minHeight: '44px',
                  maxHeight: '120px',
                }}
              />
            </div>

            {/* Emoji Button */}
            <button
              className="p-2 text-gray-500 hover:text-[#003366] transition-colors flex-shrink-0"
              aria-label="Add emoji"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="h-11 px-6 bg-[#FFC107] hover:bg-[#FFB300] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg font-['Bitter'] font-semibold text-[#003366] transition-colors flex-shrink-0"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Profile Panel (Toggleable) */}
      {showProfile && (
        <UserProfilePanel user={otherUser} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
