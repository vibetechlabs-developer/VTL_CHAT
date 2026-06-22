import { useEffect, useRef, useState } from "react";
import { Hash, Pin, Bell, Users, Search, MoreHorizontal, Loader2, Paperclip, ExternalLink, X } from "lucide-react";
import {
  formatMessageTime,
  getInitials,
  getAvatarColor,
  groupReactions,
  REACTION_EMOJI,
  REACTION_TYPES,
  getMediaUrl,
  getFileName,
} from "../../utils/helpers";
import "./MessageArea.scss";

export default function MessageArea({
  channel,
  messages = [],
  usersMap = {},
  profile,
  reactions = [],
  attachments = [],
  loading,
  onReact,
  reactingId,
}) {
  const bottomRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const channelName = channel?.name || "general";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, attachments]);

  const reactionsByMessage = reactions.reduce((acc, r) => {
    if (!acc[r.message]) acc[r.message] = [];
    acc[r.message].push(r);
    return acc;
  }, {});

  const attachmentsByMessage = attachments.reduce((acc, a) => {
    if (!acc[a.message]) acc[a.message] = [];
    acc[a.message].push(a);
    return acc;
  }, {});

  const handleReact = async (messageId, type) => {
    if (!onReact || reactingId) return;
    await onReact(messageId, type);
  };

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
          <button type="button" title="Search"><Search size={18} /></button>
          <button type="button" title="Pinned"><Pin size={18} /></button>
          <button type="button" title="Notifications"><Bell size={18} /></button>
          <button type="button" title="Members"><Users size={18} /></button>
          <button type="button" title="More"><MoreHorizontal size={18} /></button>
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
          const msgAttachments = attachmentsByMessage[msg.id] || [];
          const myReaction = (reactionsByMessage[msg.id] || []).find(
            (r) => Number(r.user) === Number(profile?.id)
          );

          return (
            <div
              key={msg.id}
              className={`message-area__message ${isSelf ? "message-area__message--self" : ""} ${
                prevSame ? "message-area__message--compact" : ""
              } ${msgReactions.length > 0 ? "message-area__message--has-reactions" : ""}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {!prevSame && (
                <div
                  className="message-area__avatar"
                  style={{ background: getAvatarColor(username) }}
                >
                  {getInitials(username)}
                </div>
              )}
              <div className="message-area__bubble-wrap">
                {hoveredId === msg.id && (
                  <div className="message-area__reaction-picker">
                    {REACTION_TYPES.map((type) => {
                      const isActive = myReaction?.reaction_type === type;
                      return (
                      <button
                        key={type}
                        type="button"
                        className={`message-area__reaction-pick ${
                          isActive ? "message-area__reaction-pick--active" : ""
                        }`}
                        title={isActive ? "Remove reaction" : `React with ${REACTION_EMOJI[type]}`}
                        onClick={() => handleReact(msg.id, type)}
                        disabled={reactingId === msg.id}
                      >
                        {REACTION_EMOJI[type]}
                      </button>
                    );})}
                  </div>
                )}

                <div className="message-area__bubble">
                  {!prevSame && (
                    <div className="message-area__meta">
                      <span className="message-area__author">{isSelf ? "You" : username}</span>
                      <span className="message-area__time">{formatMessageTime(msg.created_at)}</span>
                    </div>
                  )}
                  {msg.content && <p className="message-area__text">{msg.content}</p>}

                  {msgAttachments.length > 0 && (
                    <div className="message-area__attachments">
                      {msgAttachments.map((att) => {
                        const url = getMediaUrl(att.file);
                        const name = getFileName(att.file);
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
                        return (
                          <a
                            key={att.id}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`message-area__attachment ${isImage ? "message-area__attachment--image" : ""}`}
                          >
                            {isImage ? (
                              <img src={url} alt={name} loading="lazy" />
                            ) : (
                              <>
                                <Paperclip size={14} />
                                <span>{name}</span>
                                <ExternalLink size={12} />
                              </>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                {msgReactions.length > 0 && (
                  <div className="message-area__reactions-float">
                    {msgReactions.map((r) => {
                      const isMine = myReaction?.reaction_type === r.type;
                      return (
                      <button
                        key={r.type}
                        type="button"
                        className={`message-area__reaction-chip ${
                          isMine ? "message-area__reaction-chip--mine" : ""
                        }`}
                        title={
                          isMine
                            ? "Tap to remove your reaction"
                            : `${r.users.join(", ")} — tap to react`
                        }
                        onClick={() => handleReact(msg.id, r.type)}
                        disabled={reactingId === msg.id}
                      >
                        <span className="message-area__reaction-emoji">{REACTION_EMOJI[r.type] || "👍"}</span>
                        <span className="message-area__reaction-count">{r.count}</span>
                        {isMine && (
                          <span className="message-area__reaction-remove">
                            <X size={10} />
                          </span>
                        )}
                      </button>
                    );})}
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
