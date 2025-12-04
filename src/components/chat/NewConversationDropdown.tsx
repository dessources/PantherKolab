"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Users, User, ArrowLeft, Camera, Smile } from "lucide-react";
import ConfirmationModal from "../common/ConfirmationModal";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  searchUsersInDB,
  filterRecentUsers,
  combineSearchResults,
  debounce,
  type SearchableUser,
} from "./utils/userSearch";
import Image from "next/image";

interface RecentUser {
  id: string;
  name: string;
  avatar?: string;
}

interface NewConversationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onCreateGroup: (name: string, members: SearchableUser[]) => void;
  recentUsers: RecentUser[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function NewConversationDropdown({
  isOpen,
  onClose,
  onSelectUser,
  onCreateGroup,
  recentUsers,
  anchorRef,
}: NewConversationDropdownProps) {
  const [view, setView] = useState<
    "initial" | "selecting_members" | "group_details"
  >("initial");
  const [selectedMembers, setSelectedMembers] = useState<SearchableUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbUsers, setDbUsers] = useState<SearchableUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setView("initial");
    setSelectedMembers([]);
    setSearchQuery("");
    setGroupName("");
    setShowCancelModal(false);
  };

  // Reset state when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        handleReset();
      }, 300); // Delay to allow for closing animation
    }
  }, [isOpen]);

  const handleToggleMember = (user: SearchableUser) => {
    setSelectedMembers((prev) =>
      prev.some((member) => member.id === user.id)
        ? prev.filter((member) => member.id !== user.id)
        : [...prev, user]
    );
  };

  const filteredRecentUsers = useMemo(
    () => filterRecentUsers(recentUsers, searchQuery),
    [recentUsers, searchQuery]
  );
  const { dbUsers: uniqueDbUsers, recentUsers: uniqueRecentUsers } = useMemo(
    () => combineSearchResults(dbUsers, filteredRecentUsers),
    [dbUsers, filteredRecentUsers]
  );

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setDbUsers([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const results = await searchUsersInDB(query);
      setDbUsers(results);
      setIsSearching(false);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        (!emojiPickerRef.current || !emojiPickerRef.current.contains(target))
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    setGroupName((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const renderUserList = (
    users: SearchableUser[],
    forGroupSelection: boolean
  ) =>
    users.map((user) => (
      <div
        key={user.id}
        onClick={() => {
          if (forGroupSelection) {
            handleToggleMember(user);
          } else {
            onSelectUser(user.id);
            onClose();
          }
        }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        {forGroupSelection && (
          <input
            type="checkbox"
            checked={selectedMembers.some((m) => m.id === user.id)}
            readOnly
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        )}
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            width={10}
            height={10}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#FFB300] flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-gray-900" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate capitalize">
            {user.name}
          </p>
        </div>
      </div>
    ));

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={dropdownRef}
        className="absolute top-0 left-full ml-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 flex flex-col"
      >
        {/* Header */}
        {(view === "selecting_members" || view === "group_details") && (
          <div className="flex items-center gap-2 p-3 border-b border-gray-200">
            <button
              onClick={() =>
                setView(
                  view === "group_details" ? "selecting_members" : "initial"
                )
              }
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex flex-col">
              <h3 className="text-md font-semibold text-gray-900">
                {view === "group_details" ? "New Group" : "Add Participants"}
              </h3>
              {view === "selecting_members" && (
                <p className="text-xs text-gray-500">
                  {selectedMembers.length} selected
                </p>
              )}
            </div>
          </div>
        )}

        {/* Search Bar */}
        {(view === "initial" || view === "selecting_members") && (
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder={
                  view === "initial"
                    ? "Search users..."
                    : "Search for participants..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-gray-900 placeholder:text-gray-500"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === "initial" && (
            <>
              <div
                onClick={() => setView("selecting_members")}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-[#0066CC] flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    New Group
                  </p>
                  <p className="text-xs text-gray-500">
                    Create a group conversation
                  </p>
                </div>
              </div>
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Searching...
                </div>
              ) : uniqueDbUsers.length === 0 &&
                uniqueRecentUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery ? "No users found" : "No recent conversations"}
                </div>
              ) : (
                <>
                  {uniqueDbUsers.length > 0 && (
                    <>
                      {searchQuery && (
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                          Search Results
                        </div>
                      )}
                      {renderUserList(uniqueDbUsers, false)}
                    </>
                  )}
                  {uniqueRecentUsers.length > 0 && (
                    <>
                      {uniqueDbUsers.length > 0 && searchQuery && (
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                          Recent
                        </div>
                      )}
                      {renderUserList(uniqueRecentUsers, false)}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {view === "selecting_members" && (
            <>
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Searching...
                </div>
              ) : uniqueDbUsers.length === 0 &&
                uniqueRecentUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery
                    ? "No users found"
                    : "Start typing to find people"}
                </div>
              ) : (
                <>
                  {uniqueDbUsers.length > 0 &&
                    renderUserList(uniqueDbUsers, true)}
                  {uniqueRecentUsers.length > 0 &&
                    renderUserList(uniqueRecentUsers, true)}
                </>
              )}
            </>
          )}

          {view === "group_details" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <button className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300">
                  <Camera className="w-8 h-8" />
                </button>
                <div className="flex-1 text-xs text-gray-500">
                  Add a group avatar (optional)
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Group Name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-gray-900 placeholder:text-gray-500"
                />
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                >
                  <Smile className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute z-10 right-0">
                  <EmojiPicker onEmojiClick={handleEmojiSelect} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "selecting_members" && selectedMembers.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-white flex justify-end gap-3">
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => setView("group_details")}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0066CC] hover:bg-blue-700 rounded-lg"
            >
              Continue
            </button>
          </div>
        )}
        {view === "group_details" && (
          <div className="p-3 border-t border-gray-200 bg-white flex justify-end gap-3">
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onCreateGroup(groupName, selectedMembers);
                onClose();
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              disabled={!groupName.trim() || selectedMembers.length === 0}
            >
              Create
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleReset}
        title="Cancel Group Creation"
        message="Are you sure you want to cancel? All progress will be lost."
      />
    </>
  );
}
