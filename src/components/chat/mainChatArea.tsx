"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, Search, MoreVertical, Send, Paperclip, Smile, X } from "lucide-react";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  type: string;
  isOwn?: boolean;
}

interface Conversation {
  id: string;
  name: string;
  type: string;
  avatar: string;
  members?: number;
}

interface MainChatAreaProps {
  selectedConversation: Conversation;
  messages: Message[];
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  onToggleProfile: () => void;
  loggedInUserInitials: string;
}

export default function MainChatArea({
  selectedConversation,
  messages,
  messageInput,
  onMessageInputChange,
  onSendMessage,
  onToggleProfile,
  loggedInUserInitials,
}: MainChatAreaProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileCaption, setFileCaption] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSendMessage();
    }
  };

  const handleCallClick = () => {
    console.log("Starting call with:", selectedConversation.name);
    // TODO: Implement call functionality
  };

  const handleSearchClick = () => {
    console.log("Opening search in conversation");
    // TODO: Implement search in conversation
  };

  const handleMoreClick = () => {
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
      console.log("Sending file:", selectedFile.name, "Caption:", fileCaption);
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

      onMessageInputChange(newText);

      // Set cursor position after emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onMessageInputChange(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar (larger + rounded square) */}
          <button
            onClick={() => {
              if (selectedConversation.type === "direct") {
                onToggleProfile();
              }
            }}
            className="relative flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            {selectedConversation.type === "group" ? (
              <div className="w-14 h-14 rounded-lg bg-[#0066CC] flex items-center justify-center">
                <span className="text-white font-bold text-lg tracking-wide">
                  {selectedConversation.name.substring(0, 3).toUpperCase()}
                </span>
              </div>
            ) : (
              <img
                src={selectedConversation.avatar}
                alt={selectedConversation.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
          </button>

          {/* Group name + members */}
          <div className="flex flex-col">
            <h2 className="font-bold text-gray-900 text-xl leading-tight">
              {selectedConversation.name}
            </h2>

            {selectedConversation.type === "group" &&
              selectedConversation.members && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedConversation.members} members
                </p>
              )}
          </div>
        </div>

        {/* Icons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCallClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Start call"
          >
            <Phone className="w-6 h-6 text-gray-600" />
          </button>
          <button
            onClick={handleSearchClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Search in conversation"
          >
            <Search className="w-6 h-6 text-gray-600" />
          </button>
          <button
            onClick={handleMoreClick}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="More options"
          >
            <MoreVertical className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.isOwn ? "justify-end gap-2" : "justify-start gap-3"
            }`}
          >
            {/* Incoming avatar */}
            {!message.isOwn && (
              <button
                onClick={onToggleProfile}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "#0066CC" }}
              >
                {message.senderName.substring(0, 2).toUpperCase()}
              </button>
            )}

            {/* Bubble + Name wrapper */}
            <div
              className={`flex flex-col max-w-md ${
                message.isOwn ? "items-end" : "items-start"
              }`}
            >
              {!message.isOwn && (
                <button
                  onClick={onToggleProfile}
                  className="text-xs font-semibold text-gray-700 mb-1 hover:underline"
                >
                  {message.senderName}
                </button>
              )}

              <div
                className={`rounded-lg px-4 py-2 shadow-sm ${
                  message.isOwn
                    ? "bg-[#FFB300] text-gray-900"
                    : "bg-white text-gray-900 border border-gray-200"
                }`}
              >
                {message.type === "image" ? (
                  <img
                    src={message.content}
                    alt="Shared image"
                    className="rounded-lg max-w-xs"
                  />
                ) : (
                  <p className="text-sm leading-relaxed">{message.content}</p>
                )}
              </div>

              <span className="text-xs text-gray-500 mt-1">
                {message.timestamp}
              </span>
            </div>

            {/* OWN avatar */}
            {message.isOwn && (
              <button
                onClick={onToggleProfile}
                className="w-8 h-8 rounded-full bg-[#FFB300] flex items-center justify-center text-gray-900 text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                {loggedInUserInitials}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-20 right-6 z-50"
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleEmojiClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Add emoji"
          >
            <Smile className="w-5 h-5 text-gray-600" />
          </button>
          <input
            ref={textInputRef}
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0066CC] text-sm"
          />
          <button
            onClick={onSendMessage}
            className="p-3 bg-[#FFB300] hover:bg-[#FFA000] rounded-full transition-colors"
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
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="max-h-96 w-full object-contain rounded-lg bg-gray-100"
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
