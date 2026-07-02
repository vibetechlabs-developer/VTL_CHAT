import { Crown, Shield, Search } from "lucide-react";
import { getInitials, getAvatarColor } from "../../utils/helpers";
import { useSettings } from "../../context/SettingsContext";
import "./MemberPanel.scss";

export default function MemberPanel({ members = [], usersMap = {}, profile, teamName, onDMSelect }) {
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
              <MemberRow key={member.id} member={member} profile={profile} badge="crown" onDMSelect={onDMSelect} />
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
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function MemberRow({ member, profile, badge, onDMSelect }) {
  const { settings } = useSettings();
  const username = member.user?.username || "User";
  const isSelf = member.user?.id === profile?.id;
  const isOnline = !isSelf || settings.showOnlineStatus;

  return (
    <button 
      className={`member-panel__member ${isSelf ? "member-panel__member--self" : ""}`}
      onClick={() => {
        if (!isSelf && onDMSelect) onDMSelect(member.user.id);
      }}
    >
      <div className="member-panel__avatar" style={{ background: getAvatarColor(username) }}>
        {getInitials(username)}
        {isOnline && <span className="member-panel__status member-panel__status--online" />}
      </div>
      <div className="member-panel__info">
        <span className="member-panel__name">{isSelf ? "You" : username}</span>
        <span className="member-panel__role">{member.role === "ADMIN" ? "Admin" : "Member"}</span>
      </div>
      {badge === "crown" && <Crown size={14} className="member-panel__badge member-panel__badge--gold" />}
      {badge === "shield" && <Shield size={14} className="member-panel__badge member-panel__badge--blue" />}
    </button>
  );
}
