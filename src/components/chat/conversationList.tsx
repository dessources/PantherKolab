"use client";

import { useState, useRef } from "react";
import { Search, SquarePen, User, Users } from "lucide-react";
import NewConversationDropdown from "./NewConversationDropdown";
import { type SearchableUser } from "./utils/userSearch";
import Image from "next/image";

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

interface RecentUser {
  id: string;
  name: string;
  avatar?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation;
  onSelectConversation: (conversation: Conversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: "all" | "groups" | "dms";
  onTabChange: (tab: "all" | "groups" | "dms") => void;
  recentUsers: RecentUser[];
  onSelectUser: (userId: string) => void;
  onCreateGroup: (name: string, members: SearchableUser[]) => void;
}

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  recentUsers,
  onSelectUser,
  onCreateGroup,
}: ConversationListProps) {
  const [showNewConvDropdown, setShowNewConvDropdown] = useState(false);
  const newConvButtonRef = useRef<HTMLButtonElement>(null);
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
        <h1 className="text-3xl font-bold text-gray-900">PantherKolab</h1>
      </div>

      {/* Search Bar */}
      <div className="px-6 pb-6 border-b border-gray-200">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div className="relative">
            <button
              ref={newConvButtonRef}
              onClick={() => setShowNewConvDropdown(!showNewConvDropdown)}
              className="p-3 bg-[#0066CC] hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              title="Start new conversation"
            >
              <SquarePen className="w-5 h-5 text-white" />
            </button>

            {/* New Conversation Dropdown */}
            <NewConversationDropdown
              isOpen={showNewConvDropdown}
              onClose={() => setShowNewConvDropdown(false)}
              onSelectUser={onSelectUser}
              onCreateGroup={onCreateGroup}
              recentUsers={recentUsers}
              anchorRef={newConvButtonRef}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => onTabChange("all")}
          className={`flex-1 py-3 text-sm font-semibold cursor-pointer ${
            activeTab === "all"
              ? "text-[#0066CC] border-b-2 border-[#0066CC]"
              : "text-gray-600 hover:text-[#0066CC]"
          }`}
        >
          All
        </button>
        <button
          onClick={() => onTabChange("groups")}
          className={`flex-1 py-3 text-sm font-semibold cursor-pointer ${
            activeTab === "groups"
              ? "text-[#0066CC] border-b-2 border-[#0066CC]"
              : "text-gray-600 hover:text-[#0066CC]"
          }`}
        >
          Groups
        </button>
        <button
          onClick={() => onTabChange("dms")}
          className={`flex-1 py-3 text-sm font-semibold cursor-pointer ${
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
        {filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center text-gray-500">
              <p className="text-lg font-semibold mb-2">No conversations yet</p>
              <p className="text-sm mb-4">
                {searchQuery
                  ? "No conversations match your search"
                  : "Start a new conversation to get started"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewConvDropdown(!showNewConvDropdown)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066CC] hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <SquarePen className="w-4 h-4" />
                  <span className="text-sm font-medium">New Conversation</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={`flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors ${
                selectedConversation.id === conv.id ? "bg-blue-50" : ""
              }`}
            >
              <div className="relative flex-shrink-0">
                {conv.avatar ? (
                  <Image
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-12 h-12 rounded-full object-cover"
                    width={12}
                    height={12}
                  />
                ) : conv.type === "group" ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-700">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center border border-gray-200">
                      <span className="text-xs">👥</span>
                    </div>
                  </>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FFB300] flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-900" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm text-gray-900 truncate capitalize">
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
          ))
        )}
      </div>
    </div>
  );
}
