import { ChevronDown, Plus, Hash, Lock, Loader2 } from "lucide-react";
import { getInitials, getAvatarColor } from "../../utils/helpers";
import { useSettings } from "../../context/SettingsContext";
import Skeleton from "../vtl/Skeleton";
import "./ChannelSidebar.scss";

export default function ChannelSidebar({
  teams = [],
  channels = [],
  users = [],
  activeTeamId,
  activeChannelId,
  onTeamSelect,
  onChannelSelect,
  onDMSelect,
  profile,
  initials,
  loading,
  onCreateChannel,
}) {
  const { settings } = useSettings();
  const textChannels = channels.filter((c) => c.channel_type !== "PRIVATE" && c.channel_type !== "DIRECT" && c.team === activeTeamId);
  const dmChannels = channels.filter((c) => c.channel_type === "DIRECT");
  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];
  
  const getDMName = (channel) => {
    if (!channel.members || channel.members.length === 0) return channel.name;
    const otherId = channel.members.find(id => id !== profile?.id) || profile?.id;
    const otherUser = users.find(u => u.id === otherId);
    return otherUser ? otherUser.username : channel.name;
  };

  return (
    <aside className="channel-sidebar">
      <div className="channel-sidebar__servers">
        {teams.map((team) => (
          <button
            key={team.id}
            className={`channel-sidebar__server ${activeTeamId === team.id ? "channel-sidebar__server--active" : ""}`}
            title={team.name}
            onClick={() => onTeamSelect(team.id)}
            style={{ background: `linear-gradient(135deg, ${getAvatarColor(team.name)}, ${getAvatarColor(team.name + "2")})` }}
          >
            {team.name.charAt(0).toUpperCase()}
          </button>
        ))}
        <button className="channel-sidebar__server channel-sidebar__server--add" title="Create team">
          <Plus size={18} />
        </button>
      </div>

      <div className="channel-sidebar__panel">
        <button className="channel-sidebar__workspace">
          <span>{activeTeam?.name || "Workspace"}</span>
          <ChevronDown size={16} />
        </button>

        {loading ? (
          <div className="channel-sidebar__loading-skeletons" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Skeleton width="16px" height="16px" borderRadius="4px" />
                <Skeleton width={`${60 + (i % 3) * 10}%`} height="1rem" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="channel-sidebar__section">
              <div className="channel-sidebar__section-header">
                <span>Channels</span>
                <button title="Create channel" onClick={onCreateChannel}><Plus size={14} /></button>
              </div>
              {textChannels.length === 0 ? (
                <p className="channel-sidebar__empty">No channels yet</p>
              ) : (
                textChannels
                  .map((channel) => (
                    <button
                      key={channel.id}
                      className={`channel-sidebar__channel ${
                        activeChannelId === channel.id ? "channel-sidebar__channel--active" : ""
                      }`}
                      onClick={() => onChannelSelect(channel.id)}
                    >
                      {channel.channel_type === "PRIVATE" ? (
                        <Lock size={16} className="channel-sidebar__channel-icon" />
                      ) : (
                        <Hash size={16} className="channel-sidebar__channel-icon" />
                      )}
                      <span>{channel.name}</span>
                    </button>
                  ))
              )}
            </div>

            <div className="channel-sidebar__section">
              <div className="channel-sidebar__section-header">
                <span>Direct Messages</span>
              </div>
              {dmChannels.length === 0 ? (
                <p className="channel-sidebar__empty">No messages yet</p>
              ) : (
                dmChannels.map((channel) => {
                  const dmName = getDMName(channel);
                  return (
                    <button
                      key={channel.id}
                      className={`channel-sidebar__dm ${
                        activeChannelId === channel.id ? "channel-sidebar__dm--active" : ""
                      }`}
                      onClick={() => onChannelSelect(channel.id)}
                    >
                      <div
                        className="channel-sidebar__dm-avatar"
                        style={{ background: getAvatarColor(dmName) }}
                      >
                        {getInitials(dmName)}
                      </div>
                      <span>{dmName}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="channel-sidebar__section">
              <div className="channel-sidebar__section-header">
                <span>Team Members</span>
              </div>
              {users.slice(0, 6).map((user) => (
                <button 
                  key={user.id} 
                  className="channel-sidebar__dm"
                  onClick={() => onDMSelect && onDMSelect(user.id)}
                >
                  <div
                    className="channel-sidebar__dm-avatar"
                    style={{ background: getAvatarColor(user.username) }}
                  >
                    {getInitials(user.username)}
                  </div>
                  <span>{user.username}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="channel-sidebar__user">
          <div className="channel-sidebar__user-avatar">{initials}</div>
          <div className="channel-sidebar__user-info">
            <span className="channel-sidebar__user-name">{profile?.username || "You"}</span>
            <span className={`channel-sidebar__user-status ${!settings.showOnlineStatus ? "channel-sidebar__user-status--offline" : ""}`}>
              {settings.showOnlineStatus ? "Online" : "Invisible"}
            </span>
          </div>
          <Lock size={14} className="channel-sidebar__user-lock" />
        </div>
      </div>
    </aside>
  );
}
