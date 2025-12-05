import type { Conversation as DBConversation } from "@/types/database";

// Adapter type for ConversationList component
export interface UIConversation {
  id: string;
  name: string;
  type: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageSender?: string;
  members?: number;
  profileKey?: string;
  unread?: number;
}

// Convert DB conversation to UI conversation format
export const convertToUIConversation = (
  conv: DBConversation
): UIConversation => {
  return {
    id: conv.conversationId,
    name: conv.name,
    type: conv.type === "GROUP" ? "group" : "direct",
    avatar: conv.avatar || "",
    lastMessage: "",
    lastMessageTime: new Date(conv.createdAt).toLocaleDateString(),
    members: conv.participants?.length,
    unread: 0,
  };
};

// Get recent users from conversations for the dropdown
export const getRecentUsers = (
  conversations: DBConversation[],
  currentUserId: string
) => {
  return conversations
    .filter((conv) => conv.type === "DM")
    .map((conv) => {
      const otherUserId = conv.participants.find((id) => id !== currentUserId);
      return {
        id: otherUserId || "",
        name: conv.name || "Unknown User",
        avatar: conv.avatar || undefined,
      };
    })
    .filter((user) => user.id); // Remove any without valid IDs
};
