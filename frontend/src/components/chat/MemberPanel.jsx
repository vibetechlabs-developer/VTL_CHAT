import { Crown, Shield, Search, X, LogOut } from "lucide-react";
import { getInitials, getAvatarColor } from "../../utils/helpers";
import { useSettings } from "../../context/SettingsContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/helpers";
import "./MemberPanel.scss";

export default function MemberPanel({
  members = [],
  usersMap = {},
  profile,
  teamName,
  onDMSelect,
  onLeave,
  onRemove,
  isAdmin = false,
}) {
  const enriched = members.map((m) => ({
    ...m,
    user: usersMap[m.user] || { username: "User", id: m.user },
  }));

  const admins = enriched.filter((m) => m.role === "ADMIN");
  const regular = enriched.filter((m) => m.role !== "ADMIN");

  return (
    <aside className="member-panel">
      <div className="member-panel__header">
        <h3>{teamName ? `${teamName} — ${enriched.length} members` : `Members — ${enriched.length}`}</h3>
        <button title="Search members"><Search size={16} /></button>
      </div>

      <div className="member-panel__list">
        {admins.length > 0 && (
          <div className="member-panel__group">
            <span className="member-panel__group-label">Admins — {admins.length}</span>
            {admins.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                profile={profile}
                badge="crown"
                onDMSelect={onDMSelect}
                onLeave={onLeave}
                onRemove={onRemove}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

        <div className="member-panel__group">
          <span className="member-panel__group-label">Members — {regular.length}</span>
          {regular.length === 0 ? (
            <p className="member-panel__empty">No members in this team</p>
          ) : (
            regular.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                profile={profile}
                badge={member.role === "ADMIN" ? "shield" : null}
                onDMSelect={onDMSelect}
                onLeave={onLeave}
                onRemove={onRemove}
                isAdmin={isAdmin}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function MemberRow({ member, profile, badge, onDMSelect, onLeave, onRemove, isAdmin }) {
  const { settings } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const username = member.user?.username || "User";
  const isSelf = Number(member.user?.id) === Number(profile?.id);
  const isOnline = !isSelf || settings.showOnlineStatus;
  const avatarUrl = member.user?.avatar_url;

  const handleLeave = async (e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Leave Team",
      message: "Are you sure you want to leave this team? You will lose access to all its channels.",
      confirmText: "Leave",
      type: "danger",
    });
    if (!ok) return;
    try {
      await onLeave(member.user.id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Remove Member",
      message: `Remove ${username} from this team?`,
      confirmText: "Remove",
      type: "danger",
    });
    if (!ok) return;
    try {
      await onRemove(member.user.id);
      toast.success(`${username} removed from team`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const showLeaveBtn = isSelf && onLeave;
  const showRemoveBtn = !isSelf && isAdmin && onRemove;

  return (
    <div
      className={`member-panel__member ${isSelf ? "member-panel__member--self" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isSelf && onDMSelect) onDMSelect(member.user.id);
      }}
    >
      <div className="member-panel__avatar" style={!avatarUrl ? { background: getAvatarColor(username) } : {}}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="member-panel__avatar-img" />
        ) : (
          getInitials(username)
        )}
        {isOnline && <span className="member-panel__status member-panel__status--online" />}
      </div>
      <div className="member-panel__info">
        <span className="member-panel__name">{isSelf ? "You" : username}</span>
        <span className="member-panel__role">{member.role === "ADMIN" ? "Admin" : "Member"}</span>
      </div>
      {badge === "crown" && <Crown size={14} className="member-panel__badge member-panel__badge--gold" />}
      {badge === "shield" && <Shield size={14} className="member-panel__badge member-panel__badge--blue" />}

      {showLeaveBtn && (
        <button
          className="member-panel__action-btn member-panel__action-btn--leave"
          onClick={handleLeave}
          title="Leave team"
        >
          <LogOut size={13} />
        </button>
      )}
      {showRemoveBtn && (
        <button
          className="member-panel__action-btn member-panel__action-btn--remove"
          onClick={handleRemove}
          title={`Remove ${username}`}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
