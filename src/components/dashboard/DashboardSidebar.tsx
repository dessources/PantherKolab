"use client";

interface Group {
  id: string;
  name: string;
  code: string;
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  name: string;
  unreadCount: number;
}

interface DashboardSidebarProps {
  groups: Group[];
  directMessages: DirectMessage[];
  onConversationClick: (id: string) => void;
  onCreateGroupClick: () => void;
}

export default function DashboardSidebar({
  groups,
  directMessages,
  onConversationClick,
  onCreateGroupClick,
}: DashboardSidebarProps) {
  return (
    <aside className="bg-white rounded-xl p-6 shadow-sm h-fit sticky top-24">
      <h3 className="text-[#003366] text-sm uppercase tracking-wider mb-4 font-bold">
        Your Groups
      </h3>

      {groups.length === 0 ? (
        <div className="text-gray-500 text-sm mb-4">No groups yet</div>
      ) : (
        groups.map((group) => (
          <div
            key={group.id}
            onClick={() => onConversationClick(group.id)}
            className="p-3 mb-2 rounded-lg cursor-pointer transition-all hover:bg-[#FFB300]/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📚</span>
              <div>
                <div className="font-semibold text-sm">{group.name}</div>
                <div className="text-xs text-gray-500">{group.code}</div>
              </div>
            </div>
            {group.unreadCount > 0 && (
              <span className="bg-[#0066CC] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                {group.unreadCount}
              </span>
            )}
          </div>
        ))
      )}

      <h3 className="text-[#003366] text-sm uppercase tracking-wider mb-4 font-bold mt-8">
        Direct Messages
      </h3>

      {directMessages.length === 0 ? (
        <div className="text-gray-500 text-sm mb-4">No messages yet</div>
      ) : (
        directMessages.map((dm) => (
          <div
            key={dm.id}
            onClick={() => onConversationClick(dm.id)}
            className="p-3 mb-2 rounded-lg cursor-pointer transition-all hover:bg-[#FFB300]/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">👤</span>
              <span className="font-medium text-sm">{dm.name}</span>
            </div>
            {dm.unreadCount > 0 && (
              <span className="bg-[#0066CC] text-white px-2 py-0.5 rounded-full text-xs font-bold">
                {dm.unreadCount}
              </span>
            )}
          </div>
        ))
      )}

      <button
        onClick={onCreateGroupClick}
        className="w-full mt-4 px-4 py-2.5 bg-[#FFB300] text-[#003366] rounded-lg font-semibold hover:bg-[#FFC733] transition-all"
      >
        + Create Group
      </button>
    </aside>
  );
}
