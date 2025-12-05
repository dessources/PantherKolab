import type { Conversation as DBConversation } from "@/types/database";

// Get profile data for the current conversation
export const getProfileData = (
  selectedConversation: DBConversation | null,
  currentUserId: string
) => {
  if (!selectedConversation || selectedConversation.type === "GROUP") {
    return null;
  }

  // For DM conversations, find the other participant
  const otherUserId = selectedConversation.participants.find(
    (id) => id !== currentUserId
  );

  if (!otherUserId) return null;

  // TODO: Fetch user profile from API
  // For now, return placeholder data matching ProfileData interface
  return {
    id: otherUserId,
    name: selectedConversation.name || "Unknown User",
    email: `email@fiu.edu`,
    phone: "+1 (555) 000-0000",
    status: "Available",
    location: "Miami, FL",
    about: "FIU Student",
    groupsInCommon: [],
  };
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
