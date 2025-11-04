'use client';

import React, { useState } from 'react';
import { ChatWindowWithProfile } from '@/components/mock/chat';

// Mock data for testing
const mockCurrentUserId = 'user-123';

const mockOtherUser = {
  id: 'user-456',
  name: 'Sarah Johnson',
  username: 'sjohnson',
  avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=003366&color=FFC107&size=128',
  bio: 'Computer Science major passionate about AI and machine learning. Looking forward to connecting with fellow Panthers!',
  major: 'Computer Science',
  year: 'Junior',
  email: 'sjohn123@fiu.edu',
  phone: '+1 (305) 123-4567',
  interests: ['AI/ML', 'Web Development', 'Robotics', 'Gaming', 'Photography'],
};

const initialMessages = [
  {
    id: 'msg-1',
    content: 'Hey! How are you doing?',
    senderId: 'user-456',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    senderName: 'Sarah Johnson',
    senderAvatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=003366&color=FFC107&size=128',
  },
  {
    id: 'msg-2',
    content: "I'm good! Just finished my CS assignment. How about you?",
    senderId: 'user-123',
    timestamp: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 'msg-3',
    content: 'Nice! I still have mine to do. Are you going to the study group tomorrow?',
    senderId: 'user-456',
    timestamp: new Date(Date.now() - 3400000).toISOString(),
    senderName: 'Sarah Johnson',
    senderAvatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=003366&color=FFC107&size=128',
  },
  {
    id: 'msg-4',
    content: "Yeah, I'll be there! Should be helpful for the upcoming exam.",
    senderId: 'user-123',
    timestamp: new Date(Date.now() - 3300000).toISOString(),
  },
  {
    id: 'msg-5',
    content: 'Perfect! See you there then.',
    senderId: 'user-456',
    timestamp: new Date(Date.now() - 3200000).toISOString(),
    senderName: 'Sarah Johnson',
    senderAvatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=003366&color=FFC107&size=128',
  },
];

export default function ChatProfileTestPage() {
  const [messages, setMessages] = useState(initialMessages);

  const handleSendMessage = (content: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      content,
      senderId: mockCurrentUserId,
      timestamp: new Date().toISOString(),
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <div className="w-full h-screen">
      <ChatWindowWithProfile
        currentUserId={mockCurrentUserId}
        otherUser={mockOtherUser}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
