import { Link } from "react-router-dom";
import { Hash, Lock, MessageSquarePlus, Users } from "lucide-react";
import { getAvatarColor, getInitials } from "../../utils/helpers";
import "./ChatMobileList.scss";

export default function ChatMobileList({
  channels = [],
  teams = [],
  users = [],
  profile,
  onNewChat,
}) {
  const dmChannels = channels.filter((c) => c.channel_type === "DIRECT");
  const teamChannels = channels.filter((c) => c.channel_type !== "DIRECT");

  const getDMName = (channel) => {
    if (!channel.members?.length) return channel.name;
    const otherId = channel.members.find((id) => Number(id) !== Number(profile?.id)) || profile?.id;
    const otherUser = users.find((u) => Number(u.id) === Number(otherId));
    return otherUser?.username || channel.name;
  };

  const channelsByTeam = teams.map((team) => ({
    team,
    channels: teamChannels.filter((c) => Number(c.team) === Number(team.id)),
  })).filter((g) => g.channels.length > 0);

  return (
    <div className="chat-mobile-list">
      <div className="chat-mobile-list__header">
        <h2>Messages</h2>
        <button type="button" className="chat-mobile-list__new-btn" onClick={onNewChat}>
          <MessageSquarePlus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      {dmChannels.length > 0 && (
        <section className="chat-mobile-list__section">
          <h3>Direct Messages</h3>
          <ul>
            {dmChannels.map((ch) => {
              const name = getDMName(ch);
              return (
                <li key={ch.id}>
                  <Link to={`/chat/dm/${ch.id}`} className="chat-mobile-list__item">
                    <div
                      className="chat-mobile-list__avatar"
                      style={{ background: getAvatarColor(name) }}
                    >
                      {getInitials(name)}
                    </div>
                    <span className="chat-mobile-list__name">{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {channelsByTeam.map(({ team, channels: chs }) => (
        <section key={team.id} className="chat-mobile-list__section">
          <h3>{team.name}</h3>
          <ul>
            {chs.map((ch) => (
              <li key={ch.id}>
                <Link
                  to={`/teams/${team.id}/channels/${ch.id}`}
                  className="chat-mobile-list__item"
                >
                  <div className="chat-mobile-list__channel-icon">
                    {ch.channel_type === "PRIVATE" ? <Lock size={14} /> : <Hash size={14} />}
                  </div>
                  <span className="chat-mobile-list__name">#{ch.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {dmChannels.length === 0 && teamChannels.length === 0 && (
        <div className="chat-mobile-list__empty">
          <Users size={32} />
          <p>No conversations yet</p>
          <button type="button" className="vtl-btn vtl-btn--primary" onClick={onNewChat}>
            Start a Chat
          </button>
        </div>
      )}
    </div>
  );
}
