"use client";

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Phone,
  Search,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  X,
  MessageSquare,
  FileText,
} from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import type { Message as DBMessage, Conversation } from "@/types/database";
import Image from "next/image";
import { SummaryButton } from "@/components/SummaryButton";

interface MainChatAreaProps {
  selectedConversation: Conversation | null;
  messages: DBMessage[];
  participantNames?: { [userId: string]: string } | null;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: (content: string) => void;
  onToggleProfile: () => void;
  onUserClick?: (userId: string) => void; // New prop for clicking on user avatars/names
  loggedInUserAvatarInitials: string;
  loggedInUserId: string;
  isLoading?: boolean;
  error?: string;
  onCallClick: () => void; // New prop for the call button
  onCreateWhiteboard: () => void; // New prop for the whiteboard button
}

export interface MainChatAreaRef {
  focusInput: () => void;
}

const MainChatArea = forwardRef<MainChatAreaRef, MainChatAreaProps>(

  (

    {

      selectedConversation,

      messages,

      participantNames,

      onSendMessage,

      onToggleProfile,

      onUserClick,

      loggedInUserAvatarInitials,

      loggedInUserId,

      isLoading,

      error,

      onCallClick,

      onCreateWhiteboard,

    },

    ref

  ) => {

    // Manage input state locally

    const [messageInput, setMessageInput] = useState("");

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [fileCaption, setFileCaption] = useState("");



    const fileInputRef = useRef<HTMLInputElement>(null);

    const textInputRef = useRef<HTMLInputElement>(null);

    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);



    // Expose the focus method

    useImperativeHandle(ref, () => ({

      focusInput: () => {

        textInputRef.current?.focus();

      },

    }));



    // Auto-scroll to bottom when messages change

    useEffect(() => {

      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    }, [messages]);



    // Close emoji picker when clicking outside

    useEffect(() => {

      const handleClickOutside = (event: MouseEvent) => {

        if (

          emojiPickerRef.current &&

          !emojiPickerRef.current.contains(event.target as Node)

        ) {

          setShowEmojiPicker(false);

        }

      };



      if (showEmojiPicker) {

        document.addEventListener("mousedown", handleClickOutside);

      }



      return () => {

        document.removeEventListener("mousedown", handleClickOutside);

      };

    }, [showEmojiPicker]);



    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {

      if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        handleSendMessage();

      }

    };



    const handleSendMessage = () => {

      if (!messageInput.trim()) return;

      onSendMessage(messageInput);

      setMessageInput("");

    };



    const handleCallClick = () => {

      if (onCallClick) {

        onCallClick();

      }

    };



    const handleSearchClick = () => {

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions

      process.env.NODE_ENV !== "production" &&

        console.log("Opening search in conversation");

      // TODO: Implement search in conversation

    };



    const handleMoreClick = () => {

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions

      process.env.NODE_ENV !== "production" &&

        console.log("Opening more options");

      // TODO: Implement more options menu

    };



    const handleAttachmentClick = () => {

      fileInputRef.current?.click();

    };



    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {

      const file = e.target.files?.[0];

      if (file) {

        setSelectedFile(file);

        setFileCaption("");

      }

    };



    const handleSendFile = () => {

      if (selectedFile) {

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions

        process.env.NODE_ENV !== "production" &&

          console.log(

            "Sending file:",

            selectedFile.name,

            "Caption:",

            fileCaption

          );

        // TODO: Implement actual file upload

        setSelectedFile(null);

        setFileCaption("");

      }

    };



    const handleCancelFile = () => {

      setSelectedFile(null);

      setFileCaption("");

      if (fileInputRef.current) {

        fileInputRef.current.value = "";

      }

    };



    const handleEmojiClick = () => {

      setShowEmojiPicker(!showEmojiPicker);

    };



    const handleEmojiSelect = (emojiData: EmojiClickData) => {

      const emoji = emojiData.emoji;

      const input = textInputRef.current;



      if (input) {

        const start = input.selectionStart || 0;

        const end = input.selectionEnd || 0;

        const text = messageInput;

        const newText = text.substring(0, start) + emoji + text.substring(end);



        setMessageInput(newText);



        // Set cursor position after emoji

        setTimeout(() => {

          input.focus();

          input.setSelectionRange(start + emoji.length, start + emoji.length);

        }, 0);

      }



      setShowEmojiPicker(false);

    };



    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {

      setMessageInput(e.target.value);

    };



    // Format timestamp

    const formatTimestamp = (isoString: string) => {

      const date = new Date(isoString);

      const now = new Date();

      const diff = now.getTime() - date.getTime();

      const seconds = Math.floor(diff / 1000);

      const minutes = Math.floor(seconds / 60);

      const hours = Math.floor(minutes / 60);



      if (seconds < 60) return "Just now";

      if (minutes < 60) return `${minutes}m ago`;

      if (hours < 24) return `${hours}h ago`;

      return date.toLocaleDateString();

    };



    // Show empty state if no conversation selected

    if (!selectedConversation) {

      return (

        <div className="flex-1 flex items-center justify-center bg-gray-50">

          <div className="text-center text-gray-500">

            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />

            <h2 className="text-2xl font-bold mb-2">PantherKolab Messages</h2>

            <p className="text-lg">Select a conversation to start messaging</p>

          </div>

        </div>

      );

    }



    return (

      <div className="flex-1 flex flex-col bg-gray-50">

        {/* Chat Header */}

        <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between">

          <div className="flex items-center gap-4">

            {/* Avatar (larger + rounded square) */}

            <button

              onClick={() => {

                if (selectedConversation.type === "DM") {

                  // For DMs, find the other user's ID and use onUserClick for consistent toggle behavior

                  const otherUserId = selectedConversation.participants.find(

                    (id) => id !== loggedInUserId

                  );

                  if (otherUserId && onUserClick) {

                    onUserClick(otherUserId);

                  }

                  else {

                    onToggleProfile();

                  }

                }

              }}

              className="relative flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"

            >

              {selectedConversation.type === "GROUP" ? (

                <div className="w-14 h-14 rounded-lg bg-[#0066CC] flex items-center justify-center">

                  <span className="text-white font-bold text-lg tracking-wide">

                    {selectedConversation.name?.substring(0, 3).toUpperCase() ||

                      "GRP"}

                  </span>

                </div>

              ) : (

                <div className="w-12 h-12 rounded-lg bg-[#FFB300] flex items-center justify-center">

                  <span className="text-gray-900 font-bold text-lg">

                    {selectedConversation.name?.substring(0, 2).toUpperCase() ||

                      "DM"}

                  </span>

                </div>

              )}

            </button>



            {/* Group name + members */}

            <button

              onClick={() => {

                if (selectedConversation?.type === "DM") {

                  // For DMs, find the other user's ID and use onUserClick for consistent toggle behavior

                  const otherUserId = selectedConversation.participants.find(

                    (id) => id !== loggedInUserId

                  );

                  if (otherUserId && onUserClick) {

                    onUserClick(otherUserId);

                  }

                  else {

                    onToggleProfile();

                  }

                }

              }}

              className="flex flex-col text-left hover:opacity-80 transition-opacity cursor-pointer"

            >

              <h2 className="font-bold text-gray-900 text-xl leading-tight capitalize">

                {selectedConversation.name || "Conversation"}

              </h2>



              {selectedConversation.type === "GROUP" &&

                selectedConversation.participants && (

                  <p className="text-sm text-gray-500 mt-1">

                    {selectedConversation.participants.length} members

                  </p>

                )}

            </button>

          </div>



          {/* Icons */}

          <div className="flex items-center gap-3">

            <button

              onClick={onCreateWhiteboard}

              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"

              title="Open whiteboard"

            >

              <FileText className="w-6 h-6 text-gray-600" />

            </button>

            <button

              onClick={handleCallClick}

              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"

              title="Start call"

            >

              <Phone className="w-6 h-6 text-gray-600" />

            </button>

            <button

              onClick={handleSearchClick}

              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"

              title="Search in conversation"

            >

              <Search className="w-6 h-6 text-gray-600" />

            </button>

            <button

              onClick={handleMoreClick}

              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"

              title="More options"

            >

              <MoreVertical className="w-6 h-6 text-gray-600" />

            </button>

          </div>

        </div>

        {/* AI Summary Button */}
        {selectedConversation && messages.length >= 20 && (
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <SummaryButton
              conversationId={selectedConversation.conversationId}
            />
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-red-500">Error: {error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center text-gray-500">
                <p className="text-lg">No messages yet</p>
                <p className="text-sm mt-2">
                  Start the conversation by sending a message
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isOwn = message.senderId === loggedInUserId;

                return (
                  <div
                    key={message.messageId}
                    className={`flex ${
                      isOwn ? "justify-end gap-2" : "justify-start gap-3"
                    }`}
                  >
                    {/* Incoming avatar */}
                    {!isOwn && (
                      <button
                        onClick={() => {
                          // If onUserClick is provided, use it (for group chats)
                          // Otherwise fall back to onToggleProfile (for DMs)
                          if (onUserClick) {
                            onUserClick(message.senderId);
                          } else {
                            onToggleProfile();
                          }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                        style={{ backgroundColor: "#0066CC" }}
                      >
                        {(() => {
                          // Get sender's name from participantNames map
                          const senderName =
                            participantNames?.[message.senderId];
                          if (senderName) {
                            // Extract initials from name (e.g., "John Doe" -> "JD")
                            const names = senderName.split(" ");
                            const initials =
                              names.length >= 2
                                ? `${names[0][0]}${
                                    names[names.length - 1][0]
                                  }`.toUpperCase()
                                : senderName.substring(0, 2).toUpperCase();
                            return initials;
                          }
                          // Fallback to first 2 characters of senderId
                          return message.senderId.substring(0, 2).toUpperCase();
                        })()}
                      </button>
                    )}

                    {/* Bubble + Name wrapper */}
                    <div
                      className={`flex flex-col max-w-md ${
                        isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      {!isOwn && selectedConversation.type === "GROUP" && (
                        <button
                          onClick={() => {
                            // If onUserClick is provided, use it (for group chats)
                            // Otherwise fall back to onToggleProfile (for DMs)
                            if (onUserClick) {
                              onUserClick(message.senderId);
                            } else {
                              onToggleProfile();
                            }
                          }}
                          className="text-xs font-semibold text-gray-700 mb-1 hover:underline capitalize cursor-pointer"
                        >
                          {participantNames?.[message.senderId] ||
                            message.senderId}
                        </button>
                      )}

                      <div
                        className={`rounded-lg px-4 py-2 shadow-sm ${
                          isOwn
                            ? "bg-[#FFB300] text-gray-900"
                            : "bg-white text-gray-900 border border-gray-200"
                        }`}
                      >
                        {message.type === "IMAGE" && message.mediaUrl ? (
                          <Image
                            src={message.mediaUrl}
                            alt="Shared image"
                            className="rounded-lg max-w-xs"
                            width={300}
                            height={300}
                          />
                        ) : message.deleted ? (
                          <p className="text-sm leading-relaxed italic text-gray-500">
                            This message was deleted
                          </p>
                        ) : (
                          <p className="text-sm leading-relaxed">
                            {message.content}
                          </p>
                        )}
                      </div>

                      <span className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>

                    {/* OWN avatar */}
                    {isOwn && (
                      <button
                        onClick={onToggleProfile}
                        className="w-8 h-8 rounded-full bg-[#FFB300] flex items-center justify-center text-gray-900 text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {loggedInUserAvatarInitials}
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 relative">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-full right-8 mb-2 z-50"
            >
              <EmojiPicker onEmojiClick={handleEmojiSelect} />
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={handleAttachmentClick}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <Paperclip className="w-5 h-5 text-gray-600" />
            </button>
            {/* Emoji button and picker container */}
            <div className="relative">
              <button
                onClick={handleEmojiClick}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Add emoji"
              >
                <Smile className="w-5 h-5 text-gray-600" />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full right-0 mb-2 z-50"
                >
                  <EmojiPicker onEmojiClick={handleEmojiSelect} />
                </div>
              )}
            </div>

            <input
              ref={textInputRef}
              type="text"
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] text-sm text-gray-900 placeholder:text-gray-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="p-3 bg-[#FFB300] hover:bg-[#FFA000] rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5 text-gray-900" />
            </button>
          </div>
        </div>

        {/* File Preview Modal */}
        {selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Send File</h3>
                <button
                  onClick={handleCancelFile}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* File Preview */}
              <div className="mb-4">
                {selectedFile.type.startsWith("image/") ? (
                  <Image
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    className="max-h-96 w-full object-contain rounded-lg bg-gray-100"
                    height={384}
                    width={512}
                  />
                ) : (
                  <div className="p-8 bg-gray-100 rounded-lg text-center">
                    <Paperclip className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              {/* Caption Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={fileCaption}
                  onChange={(e) => setFileCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC] text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelFile}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendFile}
                  className="px-6 py-2 bg-[#FFB300] hover:bg-[#FFA000] rounded-lg font-semibold text-gray-900 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

MainChatArea.displayName = "MainChatArea";

export default MainChatArea;
