'use client';

import React from 'react';
import Image from 'next/image';

interface ChatMessageProps {
  message: {
    id: string;
    content: string;
    senderId: string;
    timestamp: string;
    senderName?: string;
    senderAvatar?: string;
  };
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div
      className={`flex gap-3 mb-4 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar (only for received messages) */}
      {!isOwnMessage && message.senderAvatar && (
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          <Image
            src={message.senderAvatar}
            alt={message.senderName || 'User'}
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Message Bubble */}
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Sender Name (only for received messages) */}
        {!isOwnMessage && message.senderName && (
          <p className="text-xs font-['Bitter'] text-gray-600 mb-1 px-1">
            {message.senderName}
          </p>
        )}

        {/* Message Content */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isOwnMessage
              ? 'bg-[#003366] text-white rounded-tr-sm'
              : 'bg-[#F8F9FA] text-gray-800 rounded-tl-sm'
          }`}
        >
          <p className="text-sm font-['Bitter'] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Timestamp */}
        <p
          className={`text-xs font-['Bitter'] text-gray-500 mt-1 px-1 ${
            isOwnMessage ? 'text-right' : 'text-left'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>

      {/* Spacer for sent messages to maintain alignment */}
      {isOwnMessage && <div className="w-8 flex-shrink-0" />}
    </div>
  );
}
