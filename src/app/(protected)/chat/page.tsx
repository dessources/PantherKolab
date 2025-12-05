"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MessageSquare, Phone, Settings, User, Menu } from "lucide-react";
import { useAuth } from "@/components/contexts/AuthContext";
import { useChat } from "@/hooks/useChat";
import { getRecentUsers } from "@/components/chat/utils/conversationUtils";
import {
  getProfileData,
  getCurrentUserProfileData,
  getOtherUserIdInDM,
} from "@/components/chat/utils/profileUtils";
import { getInitials } from "@/components/chat/utils/textUtils";
import ConversationList from "@/components/chat/conversationList";
import MainChatArea, {
  type MainChatAreaRef,
} from "@/components/chat/mainChatArea";
import ProfileSidebar from "@/components/chat/profilesidebar";
import CurrentUserProfileSidebar from "@/components/chat/CurrentUserProfileSidebar";
import { OutgoingCallModal } from "@/components/calls/OutgoingCallModal";
import { MeetingView } from "@/components/calls/MeetingView";
import { IncomingCallModal } from "@/components/calls/IncomingCallModal";
import { toast } from "sonner";

/**
 * Production Chat Page
 * Integrates real-time messaging with AppSync Events and DynamoDB
 */
export default function ChatPage() {
  const auth = useAuth();
  const currentUserId = auth.user?.userId || "";
  const mainChatAreaRef = useRef<MainChatAreaRef>(null);

  const {
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

    // Call-related states and actions from useChat
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
  } = useChat(currentUserId);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showCurrentUserProfile, setShowCurrentUserProfile] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Get profile data for the selected user (or the other user in DM)
  const profileUserId = selectedProfileUserId || getOtherUserIdInDM(selectedConversation, currentUserId);
  const profileData = profileUserId
    ? getProfileData(profileUserId, selectedConversation, currentUserId)
    : null;

  const handleFocusMessageInput = () => {
    mainChatAreaRef.current?.focusInput();
  };

  const currentUserName =
    selectedConversation?.participantNames?.[currentUserId] || "You";
  const currentUserInitials = getInitials(currentUserName);

  const currentUserProfileData = getCurrentUserProfileData(
    currentUserId,
    currentUserName
  );

  // Filter UI conversations based on active tab
  const filteredConversations = uiConversations.filter((conv) => {
    if (activeTab === "groups") return conv.type === "group";
    if (activeTab === "dms") return conv.type === "direct";
    return true; // "all"
  });

  // Apply search filter
  const searchedConversations = searchQuery
    ? filteredConversations.filter((conv) =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredConversations;

  const handleCallButtonClick = useCallback(
    async (
      targetRecipientId?: string,
      targetCallType: "DIRECT" | "GROUP" = "DIRECT"
    ) => {
      if (!selectedConversation) {
        toast.warning("Please select a conversation to initiate a call.");
        return;
      }
      if (!currentUserId) {
        toast.error("User not authenticated.");
        return;
      }

      let recipientIds: string[] = [];
      let callKind: "DIRECT" | "GROUP";
      let displayRecipientName: string = "";

      if (selectedConversation.type === "GROUP" || targetCallType === "GROUP") {
        // Group call
        recipientIds = selectedConversation.participants;
        callKind = "GROUP";
        displayRecipientName = selectedConversation.name || "Group Call";
      } else {
        // Direct call
        const otherUserId = selectedConversation.participants.find(
          (id) => id !== currentUserId
        );
        if (!otherUserId) {
          toast.error(
            "Cannot initiate call: No other participant found in DM."
          );
          return;
        }
        recipientIds = [currentUserId, otherUserId];
        callKind = "DIRECT";
        displayRecipientName =
          selectedConversation.participantNames?.[otherUserId] || otherUserId;
      }

      // If a specific recipientId is provided (e.g., from ProfileSidebar), ensure it's included
      if (targetRecipientId && !recipientIds.includes(targetRecipientId)) {
        recipientIds.push(targetRecipientId);
        callKind = "DIRECT"; // Force direct if calling a specific ID outside existing group context
        displayRecipientName =
          selectedConversation.participantNames?.[targetRecipientId] ||
          targetRecipientId;
      }

      setOutgoingRecipientName(displayRecipientName);
      setShowOutgoingCall(true);

      try {
        await initiateCall({
          participantIds: recipientIds,
          callType: callKind,
          conversationId:
            callKind === "GROUP"
              ? selectedConversation.conversationId
              : undefined,
        });
      } catch (error) {
        console.error("Error initiating call:", error);
        toast.error(
          "Failed to initiate call: " +
            (error instanceof Error ? error.message : "Unknown error")
        );
        setShowOutgoingCall(false); // Hide modal on error
      }
    },
    [
      currentUserId,
      selectedConversation,
      initiateCall,
      setOutgoingRecipientName,
      setShowOutgoingCall,
    ]
  );

  const handleCancelOutgoingCall = async () => {
    if (activeCall?.sessionId) {
      // Need to determine if it was an active outgoing call (RINGING state)
      // For now, if we are showing the outgoing modal, assume we can cancel
      await cancelCall(activeCall.sessionId);
    }
    setShowOutgoingCall(false);
  };

  // Handle clicking on a user's avatar or name in the chat
  // Toggle behavior: clicking the same user twice closes the profile
  const handleUserClick = useCallback((userId: string) => {
    setSelectedProfileUserId((prevUserId) => {
      // If clicking the same user, toggle off
      if (prevUserId === userId && showProfile) {
        setShowProfile(false);
        return null;
      }
      // If clicking a different user, show their profile
      setShowProfile(true);
      return userId;
    });
  }, [showProfile, setShowProfile]);

  // Handle closing the profile sidebar
  const handleCloseProfile = useCallback(() => {
    setShowProfile(false);
    setSelectedProfileUserId(null);
  }, [setShowProfile]);

  // Reset selected profile user when conversation changes
  useEffect(() => {
    setSelectedProfileUserId(null);
  }, [selectedConversation?.conversationId]);

  return (
    <div className="h-screen w-screen flex bg-white font-sans overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <div
        className={`bg-[#0066CC] flex flex-col py-6 transition-all duration-300 ${
          sidebarExpanded ? "w-40" : "w-20"
        }`}
      >
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="ml-4 mb-8 p-2 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer self-start"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <button
            className={`flex items-center gap-3 p-2 text-white bg-blue-700 rounded-lg transition-colors cursor-pointer ${
              sidebarExpanded ? "w-40 px-4" : ""
            }`}
          >
            <MessageSquare className="w-6 h-6 flex-shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm font-medium">Chats</span>
            )}
          </button>
          <button
            onClick={() => (window.location.href = "/call")} // This is currently a navigation, will remain for now
            className={`flex items-center gap-3 p-2 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer ${
              sidebarExpanded ? "w-40 px-4" : ""
            }`}
          >
            <Phone className="w-6 h-6 flex-shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm font-medium">Calls</span>
            )}
          </button>
          <button
            className={`flex items-center gap-3 p-2 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer ${
              sidebarExpanded ? "w-40 px-4" : ""
            }`}
          >
            <Settings className="w-6 h-6 flex-shrink-0" />
            {sidebarExpanded && (
              <span className="text-sm font-medium">Settings</span>
            )}
          </button>
        </div>

        <button
          onClick={() => setShowCurrentUserProfile((prev) => !prev)}
          className={`flex items-center gap-3 p-2 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer ${
            sidebarExpanded ? "w-40 mx-auto px-4" : "mx-auto"
          }`}
        >
          <User className="w-6 h-6 flex-shrink-0" />
          {sidebarExpanded && (
            <span className="text-sm font-medium">Profile</span>
          )}
        </button>
      </div>

      {/* Conversation List Container with Current User Profile */}
      <div className="relative">
        {/* Current User Profile Sidebar */}
        <CurrentUserProfileSidebar
          profileData={currentUserProfileData}
          isVisible={showCurrentUserProfile}
          onClose={() => setShowCurrentUserProfile(false)}
        />

        {/* Conversation List Component */}
        {loadingConversations ? (
          <div className="w-96 flex items-center justify-center bg-gray-50">
            <p className="text-gray-500">Loading conversations...</p>
          </div>
        ) : conversationsError ? (
          <div className="w-96 flex items-center justify-center bg-gray-50">
            <p className="text-red-500">Error: {conversationsError}</p>
          </div>
        ) : (
          <ConversationList
            conversations={searchedConversations}
            selectedConversation={selectedUIConversation!}
            onSelectConversation={handleSelectConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            recentUsers={getRecentUsers(conversations, currentUserId)}
            onSelectUser={handleSelectUser}
            onCreateGroup={handleCreateGroup}
          />
        )}
      </div>

      {/* Main Chat Area Component */}
      {!isMeetingActive ? (
        <MainChatArea
          ref={mainChatAreaRef}
          selectedConversation={selectedConversation}
          messages={messages}
          participantNames={selectedConversation?.participantNames}
          messageInput=""
          onMessageInputChange={() => {}}
          onSendMessage={handleSendMessage}
          onToggleProfile={() => setShowProfile((prev) => !prev)}
          onUserClick={handleUserClick}
          loggedInUserAvatarInitials={currentUserInitials}
          loggedInUserId={currentUserId}
          isLoading={loadingMessages}
          error={messagesError?.message}
          onCallClick={handleCallButtonClick}
        />
      ) : activeCall ? ( // Meeting View
        <MeetingView
          meetingTitle="PantherKolab Video Call"
          meetingSubtitle={selectedConversation?.name || "Meeting"}
          participants={[]} // Participants will be managed by useChimeMeeting
          activeSpeakerId=""
          isCallOwner={isCallOwner}
          meeting={meetingData?.meeting}
          attendee={
            currentUserId ? meetingData?.attendees?.[currentUserId] : undefined
          }
          localUserId={currentUserId}
          participantNames={selectedConversation?.participantNames || {}}
          onEndCall={() => endCall(activeCall.sessionId!)}
          onLeaveCall={() => leaveCall(activeCall.sessionId!)}
          onSettingsClick={() => toast.info("Settings clicked")}
        />
      ) : (
        "Loading..."
      )}

      {/* Profile Sidebar Component */}
      <ProfileSidebar
        profileData={profileData}
        isVisible={showProfile}
        onMessageClick={handleFocusMessageInput}
        onCallClick={(recipientId) => handleCallButtonClick(recipientId)}
        onClose={handleCloseProfile}
      />

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callerName={
            selectedConversation?.participantNames?.[incomingCall.callerId] ||
            incomingCall.callerName
          }
          callType={incomingCall.callType === "AUDIO" ? "DIRECT" : "DIRECT"} // Assuming "VIDEO" for now
          onAccept={() => acceptCall(incomingCall.sessionId)}
          onReject={() =>
            rejectCall(incomingCall.sessionId, incomingCall.callerId)
          }
        />
      )}

      {/* Outgoing Call Modal */}
      {showOutgoingCall && (
        <OutgoingCallModal
          recipientName={outgoingRecipientName}
          callType={activeCall?.callType || "DIRECT"} // Use activeCall type or default
          status={isRinging ? "ringing" : "initiating"}
          onCancel={handleCancelOutgoingCall}
        />
      )}
    </div>
  );
}
