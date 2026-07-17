import { Bell, MessageSquare, UserPlus, Video, AtSign, CheckCheck } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import { useWorkspace } from "../../context/WorkspaceContext";
import { formatRelativeTime, NOTIFICATION_ICONS } from "../../utils/helpers";
import DOMPurify from "dompurify";
import "./Notifications.scss";

const ICON_MAP = {
  mention: AtSign,
  message: MessageSquare,
  invite: UserPlus,
  meeting: Video,
  system: Bell,
};

export default function Notifications() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useWorkspace();

  const unreadCount = unreadNotificationCount;

  const handleClick = async (n) => {
    if (!n.is_read) await markNotificationRead(n.id);
  };

  return (
    <AppLayout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      showSearch={false}
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="notifications-page">
        {notifications.length > 0 && (
          <div className="notifications-page__toolbar">
            <button
              type="button"
              className="vtl-btn vtl-btn--ghost"
              onClick={markAllNotificationsRead}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} />}
            title="No notifications"
            description="You're all caught up. New activity will show up here."
          />
        ) : (
          <GlassCard padding={false} className="notifications-page__list">
            {[...notifications]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((n) => {
                const type = NOTIFICATION_ICONS[n.notification_type] || "system";
                const Icon = ICON_MAP[type] || Bell;
                return (
                  <div
                    key={n.id}
                    className={`notif-row ${!n.is_read ? "notif-row--unread" : ""}`}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick(n);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={`notif-row__icon notif-row__icon--${type}`}>
                      <Icon size={18} />
                    </div>
                    <div className="notif-row__body">
                      <p className="notif-row__title">
                        <strong>{n.title}</strong>
                        <span
                          className="notif-row__message"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(n.message),
                          }}
                        />
                      </p>
                      <span className="notif-row__time">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    {!n.is_read && <span className="notif-row__dot" aria-hidden="true" />}
                  </div>
                );
              })}
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
}
