import { useState, useEffect, useCallback } from "react";
import { useMessages } from "@/hooks/useMessages";
import { useCalls, type MeetingData } from "@/hooks/useCalls"; // Import useCalls and MeetingData
import {
  type ConversationWithNames,
  type Conversation as DBConversation,
} from "@/types/database";
import {
  UIConversation,
  convertToUIConversation,
} from "@/components/chat/utils/conversationUtils";
import { type SearchableUser } from "@/components/chat/utils/userSearch";
import type { UserProfile } from "@/types/UserProfile";

export const useChat = (currentUserId: string) => {
  // State management
  const [conversations, setConversations] = useState<ConversationWithNames[]>(
    []
  );
  const [uiConversations, setUiConversations] = useState<UIConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationWithNames | null>(null);
  const [selectedUIConversation, setSelectedUIConversation] =
    useState<UIConversation | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "groups" | "dms">("all");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null
  );

  // Call states
  const [showOutgoingCall, setShowOutgoingCall] = useState(false);
  const [outgoingRecipientName, setOutgoingRecipientName] = useState("");
  const [isMeetingActive, setIsMeetingActive] = useState(false); // Controls MeetingView visibility
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);

  // Real-time messaging hook
  const {
    messages,
    loading: loadingMessages,
    error: messagesError,
    sendMessage,
  } = useMessages({
    conversationId: selectedConversation?.conversationId || null,
    currentUserId,
  });

  // Callbacks for useCalls hook
  const handleCallConnected = useCallback((data: MeetingData) => {
    console.log("Call connected!", data);
    // When a call connects, we should hide any outgoing call modal
    setShowOutgoingCall(false);
    setIsMeetingActive(true); // Show the MeetingView
    setMeetingData(data); // Store meetingData for MeetingView props
  }, []);

  const handleCallEnded = useCallback((sessionId: string, endedBy: string) => {
    console.log(`Call ${sessionId} ended by ${endedBy}`);
    setShowOutgoingCall(false);
    setIsMeetingActive(false); // Hide the MeetingView
    setMeetingData(null);
    alert("Call has ended");
  }, []);

  const handleCallRejected = useCallback((sessionId: string) => {
    console.log("Call rejected:", sessionId);
    setShowOutgoingCall(false);
    alert("Call was declined");
  }, []);

  const handleCallCancelled = useCallback(
    (sessionId: string, cancelledBy: string) => {
      console.log(`Call ${sessionId} cancelled by ${cancelledBy}`);
      setShowOutgoingCall(false);
      alert("Call was cancelled");
    },
    []
  );

  const handleParticipantLeft = useCallback(
    (sessionId: string, userId: string, newOwnerId?: string) => {
      console.log(
        `Participant ${userId} left call ${sessionId}, new owner: ${newOwnerId}`
      );
      // Handle UI updates for participant leaving if necessary
    },
    []
  );

  const handleCallError = useCallback((error: string) => {
    console.error("Call error:", error);
    setShowOutgoingCall(false);
    alert("Call error: " + error);
  }, []);

  const {
    isConnected,
    activeCall,
    isRinging,
    incomingCall,
    isCallOwner,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    leaveCall,
    endCall,
  } = useCalls({
    userId: currentUserId,
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallRejected: handleCallRejected,
    onCallCancelled: handleCallCancelled,
    onParticipantLeft: handleParticipantLeft,
    onError: handleCallError,
  });

  // Fetch user's conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      if (!currentUserId) return;

      try {
        setLoadingConversations(true);
        const response = await fetch("/api/conversations", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch conversations");
        }

        const data = await response.json();
        const dbConvs: ConversationWithNames[] = data.conversations || [];
        setConversations(dbConvs);

        // Convert to UI format
        const uiConvs = dbConvs.map(convertToUIConversation);
        setUiConversations(uiConvs);

        // Auto-select first conversation if available
        if (dbConvs.length > 0) {
          setSelectedConversation(dbConvs[0]);
          setSelectedUIConversation(uiConvs[0]);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        setConversationsError(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [currentUserId]);

  // Handle conversation selection
  const handleSelectConversation = (uiConv: UIConversation) => {
    // Find corresponding DB conversation
    const dbConv = conversations.find((c) => c.conversationId === uiConv.id);
    if (dbConv) {
      setSelectedConversation(dbConv);
      setSelectedUIConversation(uiConv);
    }
    setShowProfile(false);
  };

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !selectedConversation) return;

    try {
      await sendMessage(content, "TEXT");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(
        "Failed to send message: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Handle new conversation user selection
  const handleSelectUser = async (userId: string) => {
    // Create optimistic conversation
    const tempConversationId = `temp-${Date.now()}`;
    const optimisticConversation: ConversationWithNames = {
      conversationId: tempConversationId,
      type: "DM",
      name: "Loading...",
      description: null,
      participants: [currentUserId, userId],
      participantNames: {}, // Empty for optimistic
      admins: [],
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      avatar: null,
    };

    const optimisticUIConversation =
      convertToUIConversation(optimisticConversation);

    // Optimistically update UI
    setConversations((prev) => [optimisticConversation, ...prev]);
    setUiConversations((prev) => [optimisticUIConversation, ...prev]);
    setSelectedConversation(optimisticConversation);
    setSelectedUIConversation(optimisticUIConversation);

    try {
      // Call API to create or find existing DM
      const response = await fetch("/api/conversations/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create DM");
      }

      const data = await response.json();
      const actualConversation: DBConversation = data.conversation;
      const otherUser = data.otherUser;

      const enrichedConversation: ConversationWithNames = {
        ...actualConversation,
        participantNames: {
          [currentUserId]: "You", // Assuming we don't have current user's full name here
          [otherUser.userId]:
            otherUser.fullName ||
            `${otherUser.firstName} ${otherUser.lastName}`,
        },
      };

      // Replace optimistic conversation with actual one
      setConversations((prev) =>
        prev.map((conv) =>
          conv.conversationId === tempConversationId
            ? enrichedConversation
            : conv
        )
      );
      setUiConversations((prev) =>
        prev.map((conv) =>
          conv.id === tempConversationId
            ? convertToUIConversation(enrichedConversation)
            : conv
        )
      );
      setSelectedConversation(enrichedConversation);
      setSelectedUIConversation(convertToUIConversation(enrichedConversation));
    } catch (error) {
      console.error("Error creating DM:", error);
      // Remove optimistic conversation on error
      setConversations((prev) =>
        prev.filter((conv) => !conv.conversationId.startsWith("temp-"))
      );
      setUiConversations((prev) =>
        prev.filter((conv) => !conv.id.startsWith("temp-"))
      );
      alert("Failed to create conversation. Please try again.");
    }
  };

  // Handle new group creation
  const handleCreateGroup = async (name: string, members: SearchableUser[]) => {
    if (!name.trim() || members.length === 0) {
      alert("Group name and at least one member are required.");
      return;
    }

    const memberIds = members.map((m) => m.id);
    const participantIds = [...memberIds, currentUserId];

    const participantNames: { [userId: string]: string } = {};
    members.forEach((m) => (participantNames[m.id] = m.name));
    // Assuming current user's name is not readily available here, might need to fetch
    participantNames[currentUserId] = "You";

    // Create optimistic conversation
    const tempConversationId = `temp-${Date.now()}`;
    const optimisticConversation: ConversationWithNames = {
      conversationId: tempConversationId,
      type: "GROUP",
      name: name,
      description: null,
      participants: participantIds,
      participantNames: participantNames,
      admins: [currentUserId],
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      avatar: null, // Placeholder for group avatar
    };

    const optimisticUIConversation =
      convertToUIConversation(optimisticConversation);

    // Optimistically update UI
    setConversations((prev) => [optimisticConversation, ...prev]);
    setUiConversations((prev) => [optimisticUIConversation, ...prev]);
    setSelectedConversation(optimisticConversation);
    setSelectedUIConversation(optimisticUIConversation);

    try {
      // Call API to create group
      const response = await fetch("/api/conversations/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, memberIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to create group");
      }

      const data = await response.json();
      const actualConversation: ConversationWithNames = data.conversation;

      // Replace optimistic conversation with actual one
      setConversations((prev) =>
        prev.map((conv) =>
          conv.conversationId === tempConversationId
            ? actualConversation
            : conv
        )
      );
      setUiConversations((prev) =>
        prev.map((conv) =>
          conv.id === tempConversationId
            ? convertToUIConversation(actualConversation)
            : conv
        )
      );
      setSelectedConversation(actualConversation);
      setSelectedUIConversation(convertToUIConversation(actualConversation));
    } catch (error) {
      console.error("Error creating group:", error);
      // Remove optimistic conversation on error
      setConversations((prev) =>
        prev.filter((conv) => conv.conversationId !== tempConversationId)
      );
      setUiConversations((prev) =>
        prev.filter((conv) => conv.id !== tempConversationId)
      );
      alert("Failed to create group. Please try again.");
    }
  };

  return {
    conversations,
    uiConversations,
    selectedConversation,
    selectedUIConversation,
    showProfile,
    searchQuery,
    activeTab,
    loadingConversations,
    conversationsError,
    messages,
    loadingMessages,
    messagesError,
    setSearchQuery,
    setActiveTab,
    setShowProfile,
    handleSelectConversation,
    handleSendMessage,
    handleSelectUser,
    handleCreateGroup,

    // Call-related states and actions
    isConnected,
    activeCall,
    isRinging,
    incomingCall,
    isCallOwner,
    initiateCall,
    acceptCall,
    rejectCall,
    cancelCall,
    leaveCall,
    endCall,
    showOutgoingCall,
    outgoingRecipientName,
    setOutgoingRecipientName,
    isMeetingActive,
    meetingData,
    setShowOutgoingCall,
  };
};