"use client";

import { Search } from "lucide-react";

interface Conversation {
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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation;
  onSelectConversation: (conversation: Conversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: "all" | "groups" | "dms";
  onTabChange: (tab: "all" | "groups" | "dms") => void;
}

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
}: ConversationListProps) {
  // Filter conversations based on search query and active tab
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = conv.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "groups") return matchesSearch && conv.type === "group";
    if (activeTab === "dms") return matchesSearch && conv.type === "direct";
    return matchesSearch;
  });

  return (
    <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col">
      {/* PantherKolab Header */}
      <div className="px-6 pt-8 pb-12">
        <h1
          className="text-3xl font-bold text-gray-900"
          style={{ fontFamily: "serif" }}
        >
          PantherKolab
        </h1>
      </div>

      {/* Search Bar */}
      <div className="px-6 pb-6 border-b border-gray-200">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => onTabChange("all")}
          className={`flex-1 py-3 text-sm font-semibold ${
            activeTab === "all"
              ? "text-[#0066CC] border-b-2 border-[#0066CC]"
              : "text-gray-600 hover:text-[#0066CC]"
          }`}
        >
          All
        </button>
        <button
          onClick={() => onTabChange("groups")}
          className={`flex-1 py-3 text-sm font-semibold ${
            activeTab === "groups"
              ? "text-[#0066CC] border-b-2 border-[#0066CC]"
              : "text-gray-600 hover:text-[#0066CC]"
          }`}
        >
          Groups
        </button>
        <button
          onClick={() => onTabChange("dms")}
          className={`flex-1 py-3 text-sm font-semibold ${
            activeTab === "dms"
              ? "text-[#0066CC] border-b-2 border-[#0066CC]"
              : "text-gray-600 hover:text-[#0066CC]"
          }`}
        >
          DMs
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            className={`flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
              selectedConversation.id === conv.id ? "bg-blue-50" : ""
            }`}
          >
            <div className="relative flex-shrink-0">
              {conv.type === "group" ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#0066CC] flex items-center justify-center text-white font-bold text-sm">
                    {conv.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-200">
                    <span className="text-xs">👥</span>
                  </div>
                </>
              ) : (
                <img
                  src={conv.avatar}
                  alt={conv.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-gray-900 truncate">
                  {conv.name}
                </h3>
              </div>
              <p className="text-xs text-gray-600 truncate">
                {conv.lastMessageSender && (
                  <span className="font-medium">
                    {conv.lastMessageSender.split(" ")[0]}:{" "}
                  </span>
                )}
                {conv.lastMessage}
              </p>
              {conv.type === "group" && conv.members && (
                <p className="text-xs text-gray-400 mt-1">
                  {conv.members} members
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
