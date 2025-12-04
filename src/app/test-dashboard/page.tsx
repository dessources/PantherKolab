"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/dashboard/DashboardNav";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardMainFeed from "@/components/dashboard/DashboardMainFeed";
import DashboardRightSidebar from "@/components/dashboard/DashboardRightSidebar";

interface User {
  name: string;
  email: string;
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
  memberCount: number;
}

interface DirectMessage {
  id: string;
  name: string;
  unreadCount: number;
  lastMessageAt?: string;
}

interface ActiveSession {
  id: string;
  conversationId?: string;
  title: string;
  participants: number;
  startedAt?: string;
}

interface Activity {
  unreadMessages: { value: number; color: string };
  activeGroups: { value: number; color: string };
  studySessions: { value: number; color: string };
  collaborations: { value: number; color: string };
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

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  location: string;
  borderColor: string;
  timeColor: string;
}

interface Deadline {
  id: string;
  month: string;
  day: string;
  title: string;
  dueTime: string;
}

interface DashboardData {
  user: User;
  groups: Group[];
  directMessages: DirectMessage[];
  activeSessions: ActiveSession[];
  activity: Activity;
  // MOCK DATA fields
  missedConversations?: MissedConversation[];
  suggestions?: Suggestion[];
  schedule?: ScheduleItem[];
  deadlines?: Deadline[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const dashboardData = await response.json();

        // Add MOCK DATA from JSON file
        const mockDataResponse = await fetch("/dashboard-data.json");
        if (!mockDataResponse.ok) {
          console.warn("Could not load mock data");
          setData(dashboardData);
          return;
        }
        const mockData = await mockDataResponse.json();

        // Merge real data with mock data
        setData({
          ...dashboardData,
          missedConversations: mockData.missedConversations,
          suggestions: mockData.suggestions,
          schedule: mockData.schedule,
          deadlines: mockData.deadlines,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Event Handlers
  const handleConversationClick = (conversationId: string) => {
    router.push(`/test-chat?conversationId=${conversationId}`);
  };

  const handleCreateGroup = () => {
    alert("Create Group - Feature not yet implemented");
  };

  const handleNewClick = () => {
    alert("New - Feature not yet implemented");
  };

  const handleNotificationClick = () => {
    router.push("/notifications");
  };

  const handleProfileClick = () => {
    router.push("/profile");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleViewFullChat = (conversationId: string) => {
    router.push(`/test-chat?conversationId=${conversationId}`);
  };

  const handleDismissConversation = (conversationId: string) => {
    alert(`Dismiss conversation ${conversationId} - Feature not yet implemented`);
  };

  const handleJoinGroup = (groupId: string) => {
    alert(`Join group ${groupId} - Feature not yet implemented`);
  };

  const handleJoinSession = (sessionId: string) => {
    alert(`Join session ${sessionId} - Feature not yet implemented`);
  };

  // Loading & Error States
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-xl text-red-600">
          Error: {error || "Failed to load dashboard"}
        </div>
      </div>
    );
  }

  const { user, groups, directMessages, activeSessions, activity, missedConversations, suggestions, schedule, deadlines } = data;

  // Filter for sidebar based on search
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDMs = directMessages.filter(dm =>
    dm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        unreadCount={user.stats.unreadMessages}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
        onNewClick={handleNewClick}
        onNotificationClick={handleNotificationClick}
        onProfileClick={handleProfileClick}
      />

      <div className="grid grid-cols-[280px_1fr_320px] gap-6 px-8 py-6 max-w-[1800px] mx-auto">
        <DashboardSidebar
          groups={searchQuery ? filteredGroups : groups}
          directMessages={searchQuery ? filteredDMs : directMessages}
          onConversationClick={handleConversationClick}
          onCreateGroupClick={handleCreateGroup}
        />

        <DashboardMainFeed
          user={user}
          groups={groups}
          missedConversations={missedConversations}
          suggestions={suggestions}
          onConversationClick={handleConversationClick}
          onViewFullChat={handleViewFullChat}
          onDismissConversation={handleDismissConversation}
          onJoinGroup={handleJoinGroup}
        />

        <DashboardRightSidebar
          activeSessions={activeSessions}
          activity={activity}
          schedule={schedule}
          deadlines={deadlines}
          onJoinSession={handleJoinSession}
        />
      </div>
    </div>
  );
}
