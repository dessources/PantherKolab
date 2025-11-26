"use client";

import { useState } from "react";
import chatData from "./chat-data.json";
import { MessageSquare, Phone, Settings, User } from "lucide-react";
import ConversationList from "@/components/chat/conversationList";
import MainChatArea from "@/components/chat/mainChatArea";
import ProfileSidebar from "@/components/chat/profilesidebar";

export default function TestChatPage() {
  const [selectedConversation, setSelectedConversation] = useState(
    chatData.conversations[0]
  );
  const [showProfile, setShowProfile] = useState(false);
  const messages = chatData.messages.conv1;
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "groups" | "dms">("all");

  // Get the profile data for the current conversation
  const getProfileData = () => {
    if (selectedConversation.type === "group") {
      return null;
    }
    const profileKey =
      selectedConversation.profileKey as keyof typeof chatData.users;
    return chatData.users[profileKey];
  };

  const profileData = getProfileData();

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      console.log("Sending message:", messageInput);
      setMessageInput("");
    }
  };

  const handleSelectConversation = (conv: any) => {
    setSelectedConversation(conv);
    setShowProfile(false);
  };

  return (
    <div className="h-screen flex bg-white">
      {/* Left Sidebar - Navigation */}
      <div className="w-23 bg-[#0066CC] flex flex-col items-center py-6">
        <button className="w-10 h-10 bg-[#FFB300] rounded-full flex items-center justify-center mb-8 font-bold text-gray-800 text-sm hover:bg-[#FFA000] transition-colors">
          {chatData.loggedInUser.initials}
        </button>

        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <button className="p-2 text-white bg-blue-700 rounded-lg transition-colors">
            <MessageSquare className="w-6 h-6" />
          </button>
          <button className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors">
            <Phone className="w-6 h-6" />
          </button>
          <button className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <button className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors">
          <User className="w-6 h-6" />
        </button>
      </div>

      {/* Conversation List Component */}
      <ConversationList
        conversations={chatData.conversations}
        selectedConversation={selectedConversation}
        onSelectConversation={handleSelectConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Chat Area Component */}
      <MainChatArea
        selectedConversation={selectedConversation}
        messages={messages}
        messageInput={messageInput}
        onMessageInputChange={setMessageInput}
        onSendMessage={handleSendMessage}
        onToggleProfile={() => setShowProfile((prev) => !prev)}
        loggedInUserInitials={chatData.loggedInUser.initials}
      />

      {/* Profile Sidebar Component */}
      {profileData && (
        <ProfileSidebar profileData={profileData} isVisible={showProfile} />
      )}
    </div>
  );
}
