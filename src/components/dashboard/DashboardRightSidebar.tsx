"use client";

interface ActiveSession {
  id: string;
  title: string;
  participants: number;
}

interface Activity {
  unreadMessages: { value: number; color: string };
  activeGroups: { value: number; color: string };
  studySessions: { value: number; color: string };
  collaborations: { value: number; color: string };
}

// MOCK DATA interfaces
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

interface DashboardRightSidebarProps {
  activeSessions: ActiveSession[];
  activity: Activity;
  schedule?: ScheduleItem[];
  deadlines?: Deadline[];
  onJoinSession: (id: string) => void;
}

export default function DashboardRightSidebar({
  activeSessions,
  activity,
  schedule,
  deadlines,
  onJoinSession,
}: DashboardRightSidebarProps) {
  return (
    <aside className="flex flex-col gap-6">
      {/* MOCK DATA: Today's Schedule */}
      {schedule && schedule.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-[#003366] text-lg mb-4 font-bold">
            📅 Today&apos;s Schedule{" "}
            <span className="text-xs text-gray-500 font-normal">
              (MOCK DATA)
            </span>
          </h3>

          {schedule.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-gray-50 rounded-lg mb-3 border-l-4"
              style={{ borderLeftColor: item.borderColor }}
            >
              <div
                className="text-sm font-bold mb-1"
                style={{ color: item.timeColor }}
              >
                {item.time}
              </div>
              <div className="font-semibold text-sm mb-1">{item.title}</div>
              <div className="text-xs text-gray-600">{item.location}</div>
            </div>
          ))}
        </div>
      )}

      {/* MOCK DATA: Upcoming Deadlines */}
      {deadlines && deadlines.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-[#003366] text-lg mb-4 font-bold">
            ⏰ Due Soon{" "}
            <span className="text-xs text-gray-500 font-normal">
              (MOCK DATA)
            </span>
          </h3>

          {deadlines.map((deadline) => (
            <div
              key={deadline.id}
              className="p-4 bg-gray-50 rounded-lg mb-3 flex items-center gap-3"
            >
              <div className="w-12 h-12 bg-[#FFB300] text-[#003366] rounded-lg flex flex-col items-center justify-center flex-shrink-0 font-bold">
                <div className="text-xs">{deadline.month}</div>
                <div className="text-lg leading-none">{deadline.day}</div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm mb-1">
                  {deadline.title}
                </div>
                <div className="text-xs text-red-600 font-semibold">
                  {deadline.dueTime}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Study Sessions */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-[#003366] text-lg mb-4 font-bold">
          🔴 Active Sessions
        </h3>

        {activeSessions.length === 0 ? (
          <div className="text-gray-500 text-sm">No active sessions</div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="p-4 bg-[#0066CC]/5 rounded-lg border border-[#0066CC]/20"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-sm">{session.title}</div>
                  <div className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    LIVE
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  {session.participants} participant
                  {session.participants !== 1 ? "s" : ""} active
                </div>
                <button
                  onClick={() => onJoinSession(session.id)}
                  className="w-full px-4 py-2 bg-[#0066CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0052A3] transition-all"
                >
                  Join Now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-br from-[#003366]/5 to-[#0066CC]/5 rounded-xl p-6 shadow-sm">
        <h3 className="text-[#003366] text-lg mb-4 font-bold">
          📊 Your Activity
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div
              className="text-3xl font-bold"
              style={{ color: activity.unreadMessages.color }}
            >
              {activity.unreadMessages.value}
            </div>
            <div className="text-xs text-gray-600">Unread Messages</div>
          </div>
          <div className="text-center">
            <div
              className="text-3xl font-bold"
              style={{ color: activity.activeGroups.color }}
            >
              {activity.activeGroups.value}
            </div>
            <div className="text-xs text-gray-600">Active Groups</div>
          </div>
          <div className="text-center">
            <div
              className="text-3xl font-bold"
              style={{ color: activity.studySessions.color }}
            >
              {activity.studySessions.value}
            </div>
            <div className="text-xs text-gray-600">Study Sessions</div>
          </div>
          <div className="text-center">
            <div
              className="text-3xl font-bold"
              style={{ color: activity.collaborations.color }}
            >
              {activity.collaborations.value}
            </div>
            <div className="text-xs text-gray-600">Collaborations</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
