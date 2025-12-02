"use client";

interface DashboardNavProps {
  unreadCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onNewClick: () => void;
  onNotificationClick: () => void;
  onProfileClick: () => void;
}

export default function DashboardNav({
  unreadCount,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onNewClick,
  onNotificationClick,
  onProfileClick,
}: DashboardNavProps) {
  return (
    <nav className="bg-[#003366] text-white px-8 py-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-[#FFB300] text-[#003366] w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl">
          PK
        </div>
        <span className="text-2xl font-bold">PANTHER KOLAB</span>
      </div>

      <form onSubmit={onSearchSubmit} className="flex-1 max-w-2xl mx-8">
        <input
          type="text"
          placeholder="Search messages, people, courses..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-white/15 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#FFB300] focus:bg-white/20"
        />
      </form>

      <div className="flex items-center gap-4">
        <button
          onClick={onNewClick}
          className="px-5 py-2.5 bg-[#FFB300] text-[#003366] rounded-lg font-semibold hover:bg-[#FFC733] transition-all hover:-translate-y-0.5"
        >
          + New
        </button>
        <button
          onClick={onNotificationClick}
          className="relative w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={onProfileClick}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
        >
          👤
        </button>
      </div>
    </nav>
  );
}
