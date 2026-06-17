import { useEffect, useRef } from "react";
import { Hash, Pin, Bell, Users, Search, MoreHorizontal, Loader2 } from "lucide-react";
import { formatMessageTime, getInitials, getAvatarColor, groupReactions, REACTION_EMOJI } from "../../utils/helpers";
import "./MessageArea.scss";

export default function MessageArea({
  channel,
  messages = [],
  usersMap = {},
  profile,
  reactions = [],
  loading,
}) {
  const bottomRef = useRef(null);
  const channelName = channel?.name || "general";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const reactionsByMessage = reactions.reduce((acc, r) => {
    if (!acc[r.message]) acc[r.message] = [];
    acc[r.message].push(r);
    return acc;
  }, {});

  return (
    <div className="message-area">
      <header className="message-area__header">
        <div className="message-area__channel-info">
          <Hash size={20} />
          <h2>{channelName}</h2>
          {channel?.description && (
            <span className="message-area__topic">{channel.description}</span>
          )}
        </div>
        <div className="message-area__toolbar">
          <button title="Search"><Search size={18} /></button>
          <button title="Pinned"><Pin size={18} /></button>
          <button title="Notifications"><Bell size={18} /></button>
          <button title="Members"><Users size={18} /></button>
          <button title="More"><MoreHorizontal size={18} /></button>
        </div>
      </header>

      <div className="message-area__messages">
        <div className="message-area__welcome">
          <div className="message-area__welcome-icon">
            <Hash size={32} />
          </div>
          <h3>Welcome to #{channelName}</h3>
          <p>
            {channel?.description ||
              `This is the start of the #${channelName} channel. Share updates and collaborate in real time.`}
          </p>
        </div>

        {loading && (
          <div className="message-area__loading">
            <Loader2 size={24} className="spin" />
            <span>Loading messages...</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="message-area__empty">No messages yet. Start the conversation!</p>
        )}

        {messages.map((msg, i) => {
          const sender = usersMap[msg.sender];
          const username = sender?.username || (msg.sender === profile?.id ? profile.username : "User");
          const isSelf = msg.sender === profile?.id;
          const prevSame = i > 0 && messages[i - 1].sender === msg.sender;
          const msgReactions = groupReactions(reactionsByMessage[msg.id] || [], usersMap);

          return (
            <div
              key={msg.id}
              className={`message-area__message ${isSelf ? "message-area__message--self" : ""} ${
                prevSame ? "message-area__message--compact" : ""
              }`}
            >
              {!prevSame && (
                <div
                  className="message-area__avatar"
                  style={{ background: getAvatarColor(username) }}
                >
                  {getInitials(username)}
                </div>
              )}
              <div className="message-area__bubble">
                {!prevSame && (
                  <div className="message-area__meta">
                    <span className="message-area__author">{isSelf ? "You" : username}</span>
                    <span className="message-area__time">{formatMessageTime(msg.created_at)}</span>
                  </div>
                )}
                <p className="message-area__text">{msg.content}</p>
                {msgReactions.length > 0 && (
                  <div className="message-area__reactions">
                    {msgReactions.map((r) => (
                      <button key={r.type} className="message-area__reaction">
                        {REACTION_EMOJI[r.type] || "👍"} <span>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
