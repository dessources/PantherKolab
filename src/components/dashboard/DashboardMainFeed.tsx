"use client";

interface User {
  name: string;
  greeting: string;
  stats: {
    meetings: number;
    unreadMessages: number;
  };
}

interface Group {
  id: string;
  name: string;
  code: string;
  unreadCount: number;
  isClassGroup: boolean;
}

// MOCK DATA interfaces
interface MissedConversation {
  id: string;
  emoji: string;
  title: string;
  content: string;
}

interface Suggestion {
  id: string;
  emoji: string;
  title: string;
  meta: string;
  iconStyle: string;
}

interface DashboardMainFeedProps {
  user: User;
  groups: Group[];
  missedConversations?: MissedConversation[];
  suggestions?: Suggestion[];
  onConversationClick: (id: string) => void;
  onViewFullChat: (id: string) => void;
  onDismissConversation: (id: string) => void;
  onJoinGroup: (id: string) => void;
}

export default function DashboardMainFeed({
  user,
  groups,
  missedConversations,
  suggestions,
  onConversationClick,
  onViewFullChat,
  onDismissConversation,
  onJoinGroup,
}: DashboardMainFeedProps) {
  return (
    <main className="flex flex-col gap-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-[#003366] to-[#0066CC] text-white px-8 py-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2">
          {user.greeting}, {user.name}! 👋
        </h1>
        <p className="text-lg opacity-90">
          You have {user.stats.meetings} active sessions and{" "}
          {user.stats.unreadMessages} unread messages.
        </p>
      </div>

      {/* Active Groups */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#003366]">
            Your Active Groups
          </h2>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            No active groups. Create or join a group to get started!
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-[#0066CC] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm font-bold text-[#0066CC] bg-[#0066CC]/10 px-3 py-1 rounded-md">
                    {group.code}
                  </span>
                  {group.unreadCount > 0 && (
                    <span className="bg-[#0066CC] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                      {group.unreadCount}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-2 text-gray-900">
                  {group.name}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span>
                    {group.isClassGroup ? "📅 Class Group" : "👥 Study Group"}
                  </span>
                </div>
                <button
                  onClick={() => onConversationClick(group.id)}
                  className="w-full px-4 py-2 bg-[#FFB300] text-[#003366] rounded-lg font-semibold text-sm hover:bg-[#FFC733] transition-all"
                >
                  View Messages
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MOCK DATA: Missed Conversations (AI Summaries) */}
      {missedConversations && missedConversations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#003366]">
              Missed Conversations{" "}
              <span className="text-sm text-gray-500 font-normal">
                (MOCK DATA)
              </span>
            </h2>
          </div>

          {missedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-[#FFB500] mb-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{conversation.emoji}</span>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {conversation.title}
                  </div>
                  <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 mt-1">
                    ✨ AI Summary
                  </div>
                </div>
              </div>
              <p className="text-gray-700 mb-4 leading-relaxed">
                {conversation.content}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewFullChat(conversation.id)}
                  className="px-4 py-2 bg-[#FFB300] text-[#003366] rounded-lg font-semibold text-sm hover:bg-[#FFC733] transition-all"
                >
                  View Full Chat
                </button>
                <button
                  onClick={() => onDismissConversation(conversation.id)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* MOCK DATA: Suggested Groups */}
      {suggestions && suggestions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#003366]">
              Suggested For You{" "}
              <span className="text-sm text-gray-500 font-normal">
                (MOCK DATA)
              </span>
            </h2>
          </div>

          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4 mb-4 hover:shadow-md transition-all"
            >
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: suggestion.iconStyle }}
              >
                {suggestion.emoji}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{suggestion.title}</div>
                <div className="text-sm text-gray-600">{suggestion.meta}</div>
              </div>
              <button
                onClick={() => onJoinGroup(suggestion.id)}
                className="px-5 py-2.5 bg-[#FFB300] text-[#003366] rounded-lg font-semibold hover:bg-[#FFC733] transition-all"
              >
                Join Group
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
