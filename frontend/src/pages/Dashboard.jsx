import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Hash,
  MessageSquare,
  Video,
  Plus,
  Calendar,
  Clock,
  UserPlus,
  Bell,
  Activity,
  MoreVertical,
} from "lucide-react";
import AppLayout from "../components/vtl/AppLayout";
import GlassCard from "../components/vtl/GlassCard";
import StatCard from "../components/vtl/StatCard";
import EmptyState from "../components/vtl/EmptyState";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  formatRelativeTime,
  formatMeetingDate,
  formatMeetingTime,
  getInitials,
  getAvatarColor,
} from "../utils/helpers";
import "./Dashboard.scss";

const NOTIF_TYPE_MAP = {
  MESSAGE: "post",
  MEETING: "meeting",
  MENTION: "user",
  TEAM: "user",
  CHANNEL: "post",
  SYSTEM: "file",
};

export default function Dashboard() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    teams,
    channels,
    messages,
    meetings,
    notifications,
    usersMap,
    unreadNotificationCount,
  } = useWorkspace();
  const [search, setSearch] = useState("");

  const stats = [
    {
      title: "Teams",
      value: String(teams.length),
      growth: teams.length ? "Active" : "—",
      isPositive: true,
      color: "#7C3AED",
      gradientId: "s-teams",
      sparkline: "M0,25 Q15,5 30,18 T60,8 T90,20 L100,5",
      icon: <Users size={20} />,
    },
    {
      title: "Channels",
      value: String(channels.length),
      growth: channels.length ? "Live" : "—",
      isPositive: true,
      color: "#2563EB",
      gradientId: "s-channels",
      sparkline: "M0,20 Q20,10 40,25 T80,5 L100,15",
      icon: <Hash size={20} />,
    },
    {
      title: "Messages",
      value: messages.length.toLocaleString(),
      growth: messages.length ? "Total" : "—",
      isPositive: true,
      color: "#10B981",
      gradientId: "s-messages",
      sparkline: "M0,28 Q10,15 30,22 T60,5 T90,12 L100,2",
      icon: <MessageSquare size={20} />,
    },
    {
      title: "Meetings",
      value: String(meetings.length),
      growth: meetings.length ? "Scheduled" : "—",
      isPositive: true,
      color: "#EF4444",
      gradientId: "s-meetings",
      sparkline: "M0,5 Q30,8 50,25 T90,20 L100,28",
      icon: <Video size={20} />,
    },
  ];

  const activities = useMemo(
    () =>
      [...notifications]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map((n) => ({
          user: n.title,
          action: n.message,
          time: formatRelativeTime(n.created_at),
          type: NOTIF_TYPE_MAP[n.notification_type] || "post",
        })),
    [notifications]
  );

  const upcomingMeetings = useMemo(
    () =>
      [...meetings]
        .filter((m) => new Date(m.start_time) >= new Date())
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 3),
    [meetings]
  );

  const recentChats = useMemo(() => {
    const byChannel = {};
    messages.forEach((msg) => {
      if (!byChannel[msg.channel] || new Date(msg.created_at) > new Date(byChannel[msg.channel].created_at)) {
        byChannel[msg.channel] = msg;
      }
    });
    return Object.values(byChannel)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3)
      .map((msg) => {
        const channel = channels.find((c) => c.id === msg.channel);
        const sender = usersMap[msg.sender];
        return {
          name: channel?.name ? `#${channel.name}` : "Channel",
          msg: msg.content,
          time: formatRelativeTime(msg.created_at),
          initials: getInitials(sender?.username || "CH"),
          color: getAvatarColor(channel?.name || "ch"),
          channelId: msg.channel,
        };
      });
  }, [messages, channels, usersMap]);

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`Welcome back, ${profile?.username || "there"} 👋`}
      searchValue={search}
      onSearchChange={setSearch}
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <section className="dash-hero">
        <div className="dash-hero__content">
          <h2>Your collaboration hub</h2>
          <p>Teams, channels, meetings, and real-time chat — unified in one premium workspace.</p>
          <div className="dash-hero__actions">
            <Link to="/teams" className="vtl-btn vtl-btn--primary">
              <Plus size={16} /> Create Team
            </Link>
            <Link to="/meetings" className="vtl-btn vtl-btn--ghost">
              <Video size={16} /> Start Meeting
            </Link>
          </div>
        </div>
      </section>

      <section className="dash-stats">
        {stats.map((s) => (
          <StatCard key={s.gradientId} {...s} />
        ))}
      </section>

      <section className="dash-grid">
        <GlassCard className="dash-card">
          <div className="dash-card__head">
            <Activity size={18} /> <h4>Activity</h4>
            <button className="dash-card__menu"><MoreVertical size={16} /></button>
          </div>
          {activities.length === 0 ? (
            <EmptyState
              icon={<Bell size={24} />}
              title="No activity yet"
              description="Notifications and updates will appear here."
            />
          ) : (
            <div className="dash-timeline">
              {activities.map((a, i) => (
                <div key={i} className="dash-timeline__item">
                  <div className={`dash-timeline__icon dash-timeline__icon--${a.type}`}>
                    {a.type === "meeting" ? <Calendar size={14} /> : a.type === "user" ? <UserPlus size={14} /> : <MessageSquare size={14} />}
                  </div>
                  <div>
                    <p><strong>{a.user}</strong> {a.action}</p>
                    <span><Clock size={11} /> {a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="dash-card">
          <div className="dash-card__head">
            <Calendar size={18} /> <h4>Upcoming Meetings</h4>
          </div>
          {upcomingMeetings.length === 0 ? (
            <EmptyState
              icon={<Video size={24} />}
              title="No upcoming meetings"
              description="Schedule a meeting from the Meetings page."
            />
          ) : (
            <div className="dash-meetings">
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="dash-meetings__item">
                  <div>
                    <h5>{m.title}</h5>
                    <span className="dash-meetings__date">{formatMeetingDate(m.start_time)}</span>
                    <span className="dash-meetings__time">{formatMeetingTime(m.start_time, m.end_time)}</span>
                  </div>
                  <div className="dash-meetings__footer">
                    <span className="dash-meetings__host">
                      {usersMap[m.host]?.username || "Host"}
                    </span>
                    <Link to="/meetings" className="vtl-btn vtl-btn--sm">Join</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      <section className="dash-section">
        <h4>Recent Chats</h4>
        {recentChats.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} />}
            title="No messages yet"
            description="Head to Chat to start a conversation."
            action={
              <Link to="/chat" className="vtl-btn vtl-btn--primary">Open Chat</Link>
            }
          />
        ) : (
          <div className="dash-chats">
            {recentChats.map((c) => (
              <Link to="/chat" key={c.channelId} className="dash-chat-link">
                <GlassCard hover className="dash-chat">
                  <div className="dash-chat__avatar" style={{ background: c.color }}>
                    {c.initials}
                  </div>
                  <div className="dash-chat__body">
                    <div className="dash-chat__top">
                      <h6>{c.name}</h6>
                      <span>{c.time}</span>
                    </div>
                    <p>{c.msg}</p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
