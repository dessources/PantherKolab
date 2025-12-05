import type { ConversationWithNames } from "@/types/database";

// Get profile data for a specific user
export const getProfileData = (
  userId: string,
  selectedConversation: ConversationWithNames | null,
  currentUserId: string
) => {
  if (!userId || !selectedConversation) {
    return null;
  }

  // Don't show profile for current user (use getCurrentUserProfileData instead)
  if (userId === currentUserId) {
    return null;
  }

  // Get user's name from participantNames
  const userName = selectedConversation.participantNames[userId] || "Unknown User";

  // TODO: Fetch user profile from API
  // For now, return placeholder data matching ProfileData interface
  return {
    id: userId,
    name: userName,
    email: `email@fiu.edu`,
    phone: "+1 (555) 000-0000",
    status: "Available",
    location: "Miami, FL",
    about: "FIU Student",
    groupsInCommon: [],
  };
};

// Helper function to get the other user's ID in a DM conversation
export const getOtherUserIdInDM = (
  selectedConversation: ConversationWithNames | null,
  currentUserId: string
): string | null => {
  if (!selectedConversation || selectedConversation.type === "GROUP") {
    return null;
  }

  // For DM conversations, find the other participant
  const otherUserId = selectedConversation.participants.find(
    (id) => id !== currentUserId
  );

  return otherUserId || null;
};

// Get current user's profile data
export const getCurrentUserProfileData = (
  currentUserId: string,
  currentUserName: string
) => {
  if (!currentUserId) return null;

  // TODO: Fetch user profile from API
  // For now, return placeholder data
  return {
    id: currentUserId,
    name: currentUserName,
    email: `${currentUserName.toLowerCase().replace(/\s+/g, ".")}@fiu.edu`,
    status: "Available",
    location: "Miami, FL",
    about: "FIU Student",
  };
};
