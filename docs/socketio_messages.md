# Socket.IO Messaging Guide

Simple guide for using authenticated Socket.IO messaging and conversations.

## Overview

All Socket.IO connections require authentication. The server automatically uses your authenticated user ID for all messages - you cannot send messages as someone else.

## Getting Your Access Token

Use the `getAccessToken()` function from `useAuth()`:

```tsx
import { useAuth } from '@/components/contexts/AuthContext';

const { getAccessToken } = useAuth();
const token = await getAccessToken();
```

This automatically handles token expiration and refresh.

## Connecting to Socket.IO

### Basic Connection

```tsx
import { useAuth } from '@/components/contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

function ChatPage() {
  const { getAccessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const connectSocket = async () => {
      const token = await getAccessToken();

      if (!token) {
        console.error('No access token available');
        return;
      }

      // Connect with JWT token
      const newSocket = io({
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Connected:', newSocket.id);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
      });

      setSocket(newSocket);
    };

    connectSocket();

    return () => {
      socket?.disconnect();
    };
  }, []);

  return <div>{/* Your chat UI */}</div>;
}
```

## Joining a Conversation

```tsx
// Join a conversation room
socket?.emit('join-conversation', conversationId);

// Listen for join confirmation
socket?.on('joined-conversation', (data) => {
  console.log(`Joined conversation: ${data.conversationId}`);
});
```

## Sending Messages

**Important**: Do NOT send `senderId` - the server automatically uses your authenticated user ID.

```tsx
const sendMessage = (conversationId: string, content: string) => {
  socket?.emit('send-message', {
    conversationId,
    content
    // senderId is NOT needed - server uses your JWT user ID
  });
};
```

## Receiving Messages

```tsx
useEffect(() => {
  if (!socket) return;

  // Listen for new messages
  socket.on('new-message', (message) => {
    console.log('New message:', message);
    // message = { id, conversationId, senderId, content, createdAt }
  });

  return () => {
    socket.off('new-message');
  };
}, [socket]);
```

## Typing Indicators

```tsx
// Send typing start
const handleTypingStart = (conversationId: string) => {
  socket?.emit('typing-start', { conversationId });
};

// Send typing stop
const handleTypingStop = (conversationId: string) => {
  socket?.emit('typing-stop', { conversationId });
};

// Listen for typing events
socket?.on('user-typing', (data) => {
  console.log(`${data.userId} is typing in ${data.conversationId}`);
});

socket?.on('user-stopped-typing', (data) => {
  console.log(`${data.userId} stopped typing in ${data.conversationId}`);
});
```

## Loading Conversations

Use the REST API to load conversations:

```tsx
const { getAccessToken } = useAuth();

const loadConversations = async () => {
  const token = await getAccessToken();

  if (!token) return;

  const response = await fetch('/api/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const conversations = await response.json();
  return conversations;
};
```

## Complete Example

```tsx
'use client';
import { useAuth } from '@/components/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const { getAccessToken, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const conversationId = 'conv-123'; // Your conversation ID

  // Connect to Socket.IO
  useEffect(() => {
    const connect = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const newSocket = io({ auth: { token } });

      newSocket.on('connect', () => {
        console.log('Connected');
        // Join conversation
        newSocket.emit('join-conversation', conversationId);
      });

      newSocket.on('new-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      setSocket(newSocket);
    };

    connect();

    return () => {
      socket?.disconnect();
    };
  }, []);

  // Send message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !socket) return;

    socket.emit('send-message', {
      conversationId,
      content: messageInput
    });

    setMessageInput('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.senderId === user?.userId ? 'You' : msg.senderId}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <input
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
```

## Available Socket Events

### Emit (Client → Server)
- `join-conversation` - Join a conversation room
  ```tsx
  socket.emit('join-conversation', conversationId);
  ```

- `send-message` - Send a message
  ```tsx
  socket.emit('send-message', { conversationId, content });
  ```

- `typing-start` - Notify typing started
  ```tsx
  socket.emit('typing-start', { conversationId });
  ```

- `typing-stop` - Notify typing stopped
  ```tsx
  socket.emit('typing-stop', { conversationId });
  ```

### Listen (Server → Client)
- `joined-conversation` - Confirmation of joining
  ```tsx
  socket.on('joined-conversation', (data) => {});
  ```

- `new-message` - New message received
  ```tsx
  socket.on('new-message', (message) => {});
  ```

- `user-typing` - User started typing
  ```tsx
  socket.on('user-typing', (data) => {});
  ```

- `user-stopped-typing` - User stopped typing
  ```tsx
  socket.on('user-stopped-typing', (data) => {});
  ```

## Important Notes

1. **Authentication is required** - Every Socket.IO connection must include a valid JWT token in the `auth` object.

2. **Don't send senderId** - The server extracts your user ID from your JWT token. Any `senderId` you send will be ignored.

3. **Token refresh is automatic** - `getAccessToken()` handles expired tokens automatically.

4. **Clean up connections** - Always disconnect the socket in the cleanup function to avoid memory leaks.

5. **Join conversations** - You must emit `join-conversation` before you'll receive messages for that conversation.
