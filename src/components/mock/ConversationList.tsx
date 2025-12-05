/**
 * Mock ConversationList Component
 *
 * Temporary component for testing message transfer functionality
 * Will be replaced by frontend team's implementation
 */

"use client";

export interface MockConversation {
  conversationId: string;
  name: string;
  type: "DM" | "GROUP";
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  avatar?: string;
  participants: string[];
}

interface ConversationListProps {
  conversations: MockConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation?: () => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
}: ConversationListProps) {
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="w-96 bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">PantherKolab</h1>

        {/* Search */}
        <div className="relative mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border-0 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button className="flex-1 pb-2 text-sm font-medium text-gray-900 border-b-2 border-yellow-500">
            All
          </button>
          <button className="flex-1 pb-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Groups
          </button>
          <button className="flex-1 pb-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            DMs
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div className="text-gray-500">
              <p className="text-4xl mb-2">💭</p>
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new conversation</p>
            </div>
          </div>
        ) : (
          conversations.map((conversation) => {
            const initials = conversation.name
              .split(" ")
              .map((word) => word[0])
              .join("")
              .toUpperCase()
              .substring(0, 3);

            return (
              <button
                key={conversation.conversationId}
                onClick={() =>
                  onSelectConversation(conversation.conversationId)
                }
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                  activeConversationId === conversation.conversationId
                    ? "bg-blue-50"
                    : ""
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {initials}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-bold text-gray-900 text-sm mb-0.5">
                    {conversation.name}
                  </h3>
                  <p className="text-xs text-gray-600 truncate">
                    {conversation.lastMessage || ""}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
