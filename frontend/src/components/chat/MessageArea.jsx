import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "../../context/ConfirmContext";
import {
  MoreHorizontal,
  Paperclip,
  Smile,
  Hash,
  Download,
  Eye,
  Trash2,
  Pin,
  Edit2,
  Search,
  Users,
  Bell,
  Loader2,
  ExternalLink,
  X,
  PhoneCall,
  PhoneOff,
  Video,
  AlertCircle,
} from "lucide-react";
import {
  formatMessageTime,
  getInitials,
  getAvatarColor,
  groupReactions,
  getMediaUrl,
  getFileName,
  getChannelDisplayName,
} from "../../utils/helpers";
import { useReactionChoices } from "../../hooks/useReactionChoices";
import Skeleton from "../vtl/Skeleton";
import DOMPurify from "dompurify";
import "./MessageArea.scss";

const renderContentWithMentions = (content, usersMap, onDMSelect) => {
  if (!content) return null;
  const mentionRegex = /(@[a-zA-Z0-9_]+)/g;
  const parts = content.split(mentionRegex);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const username = part.slice(1);
      const user = Object.values(usersMap).find((u) => u.username === username);
      if (user) {
        return (
          <span
            key={i}
            className="mention"
            onClick={(e) => {
              e.stopPropagation();
              if (onDMSelect) onDMSelect(user.id);
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={i} className="mention mention--unknown">{part}</span>;
    }
    return DOMPurify.sanitize(part);
  });
};

export default function MessageArea({
  channel,
  messages = [],
  usersMap = {},
  profile,
  reactions = [],
  attachments = [],
  loading,
  loadingOlder = false,
  hasOlder = false,
  onLoadOlder,
  typingUsers = {},
  onReact,
  reactingId,
  onPin,
  onEditMessage,
  onDeleteMessage,
  onToggleMembers,
  onClearChat,
  onDMSelect,
  onVideoCall,
  onAudioCall,
}) {
  const confirm = useConfirm();
  const { reactionEmoji, reactionTypes } = useReactionChoices();
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const topSentinelRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const prevMessageCountRef = useRef(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const channelName = getChannelDisplayName(channel, profile?.id, usersMap);

  const [previewAttachment, setPreviewAttachment] = useState(null);

  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || "download");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, "_blank");
    }
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (messages.length > prevMessageCountRef.current && prevScrollHeightRef.current > 0) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (loadingOlder) return;
    if (!shouldStickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, attachments, loading, loadingOlder]);

  useEffect(() => {
    if (!onLoadOlder || !hasOlder || loadingOlder) return;
    const root = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          prevScrollHeightRef.current = root.scrollHeight;
          onLoadOlder();
        }
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadOlder, hasOlder, loadingOlder, messages.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  };

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

  const handleSaveEdit = async (messageId) => {
    if (!editingText.trim() || !onEditMessage) return;
    await onEditMessage(messageId, editingText.trim());
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleDeleteClick = async (messageId) => {
    if (!onDeleteMessage) return;
    const confirmed = await confirm({
      title: "Delete Message",
      message: "Are you sure you want to delete this message? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (confirmed) {
      await onDeleteMessage(messageId);
    }
  };

  const handleClearClick = async () => {
    if (!onClearChat) return;
    const confirmed = await confirm({
      title: "Clear Chat",
      message: "Are you sure you want to delete all messages in this channel? This action cannot be undone.",
      confirmText: "Clear All",
      type: "danger",
    });
    if (confirmed) {
      await onClearChat();
    }
  };

  return (
    <div className="message-area">
      <header className="message-area__header">
        <div className="message-area__channel-info">
          {channel?.channel_type === "DIRECT" ? (
            <div
              className="message-area__avatar message-area__avatar--dm"
              style={{ background: getAvatarColor(channelName), width: 24, height: 24, fontSize: '0.65rem', marginBottom: 0 }}
            >
              {getInitials(channelName)}
            </div>
          ) : (
            <Hash size={20} />
          )}
          <h2>{channelName}</h2>
          {channel?.description && (
            <span className="message-area__topic">{channel.description}</span>
          )}
        </div>
        <div className="message-area__toolbar">
          {showSearchInput && (
            <input
              type="text"
              className="message-area__search-input"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          )}
          <button 
            type="button" 
            title="Search"
            className={`message-area__toolbar-btn message-area__toolbar-btn--search ${showSearchInput ? "active" : ""}`}
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              if (showSearchInput) setSearchQuery("");
            }}
          >
            <Search size={18} />
          </button>

          {/* Call buttons — shown in all channels (like Teams) */}
          {onAudioCall && (
            <button
              type="button"
              title="Start audio call"
              className="message-area__call-btn message-area__call-btn--audio message-area__toolbar-btn message-area__toolbar-btn--audio"
              onClick={onAudioCall}
            >
              <PhoneCall size={18} />
            </button>
          )}
          {onVideoCall && (
            <button
              type="button"
              title="Start video call"
              className="message-area__call-btn message-area__call-btn--video message-area__toolbar-btn message-area__toolbar-btn--video"
              onClick={onVideoCall}
            >
              <Video size={18} />
            </button>
          )}
          <button 
            type="button" 
            title="Pinned"
            className={`message-area__toolbar-btn message-area__toolbar-btn--pinned ${showPinnedOnly ? "active" : ""}`}
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
          >
            <Pin size={18} />
          </button>
          <button
            type="button"
            title="Notifications"
            className="message-area__toolbar-btn message-area__toolbar-btn--notifications"
            onClick={() =>
              confirm({
                title: "Notifications",
                message: "Notifications coming soon!",
                confirmText: "OK",
                cancelText: null,
              })
            }
          >
            <Bell size={18} />
          </button>
          <button 
            type="button" 
            title="Members" 
            className="message-area__toolbar-btn message-area__toolbar-btn--members"
            onClick={onToggleMembers}
          >
            <Users size={18} />
          </button>
          {onClearChat && (
            <button
              type="button"
              title="Clear Chat"
              className="message-area__toolbar-btn message-area__toolbar-btn--clear"
              onClick={handleClearClick}
            >
              <Trash2 size={18} />
            </button>
          )}

          {/* More options wrapper */}
          <div className="message-area__more-wrapper" ref={moreMenuRef}>
            <button
              type="button"
              title="More options"
              className={moreMenuOpen ? "active" : ""}
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            >
              <MoreHorizontal size={18} />
            </button>

            {moreMenuOpen && (
              <div className="message-area__more-dropdown">
                {onAudioCall && (
                  <button
                    type="button"
                    className="message-area__dropdown-item message-area__dropdown-item--audio"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onAudioCall();
                    }}
                  >
                    <PhoneCall size={15} />
                    <span>Audio Call</span>
                  </button>
                )}
                {onVideoCall && (
                  <button
                    type="button"
                    className="message-area__dropdown-item message-area__dropdown-item--video"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onVideoCall();
                    }}
                  >
                    <Video size={15} />
                    <span>Video Call</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`message-area__dropdown-item message-area__dropdown-item--pinned ${showPinnedOnly ? "active" : ""}`}
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setShowPinnedOnly(!showPinnedOnly);
                  }}
                >
                  <Pin size={15} />
                  <span>Pinned Messages</span>
                </button>
                <button
                  type="button"
                  className="message-area__dropdown-item message-area__dropdown-item--notifications"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    confirm({
                      title: "Notifications",
                      message: "Notifications coming soon!",
                      confirmText: "OK",
                      cancelText: null,
                    });
                  }}
                >
                  <Bell size={15} />
                  <span>Notifications</span>
                </button>
                <button
                  type="button"
                  className="message-area__dropdown-item message-area__dropdown-item--members"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onToggleMembers();
                  }}
                >
                  <Users size={15} />
                  <span>Members</span>
                </button>
                {onClearChat && (
                  <button
                    type="button"
                    className="message-area__dropdown-item message-area__dropdown-item--clear message-area__dropdown-item--danger"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      handleClearClick();
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Clear Chat</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="message-area__messages" ref={scrollRef} onScroll={handleScroll}>
        <div ref={topSentinelRef} className="message-area__top-sentinel" aria-hidden="true" />
        {loadingOlder && (
          <div className="message-area__loading-older">
            <Loader2 size={18} className="spin" />
            <span>Loading older messages...</span>
          </div>
        )}
        <div className="message-area__welcome">
          <div className="message-area__welcome-icon">
            {channel?.channel_type === "DIRECT" ? (() => {
              const otherId = channel.members?.find((id) => Number(id) !== Number(profile?.id)) || profile?.id;
              const otherUser = usersMap[otherId];
              const welcomeAvatarUrl = otherUser?.avatar_url;
              return (
                <div
                  className="message-area__avatar message-area__avatar--dm"
                  style={!welcomeAvatarUrl ? { background: getAvatarColor(channelName), width: 64, height: 64, fontSize: '1.5rem', marginBottom: 0 } : { width: 64, height: 64, marginBottom: 0, overflow: 'hidden' }}
                >
                  {welcomeAvatarUrl ? (
                    <img src={welcomeAvatarUrl} alt={channelName} className="message-area__avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '7px' }} />
                  ) : (
                    getInitials(channelName)
                  )}
                </div>
              );
            })() : (
              <Hash size={32} />
            )}
          </div>
          <h3>{channel?.channel_type === "DIRECT" ? `Direct Message with ${channelName}` : `Welcome to #${channelName}`}</h3>
          <p>
            {channel?.description ||
              (channel?.channel_type === "DIRECT"
                ? `This is the start of your direct message history with ${channelName}.`
                : `This is the start of the #${channelName} channel. Share updates and collaborate in real time.`)}
          </p>
        </div>

        {loading && (
          <div className="message-area__loading-skeletons" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1rem" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: "flex", gap: "1rem" }}>
                <Skeleton width="40px" height="40px" borderRadius="12px" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Skeleton width="120px" height="1rem" />
                    <Skeleton width="60px" height="1rem" />
                  </div>
                  <Skeleton width={`${80 - (i % 3) * 15}%`} height="1rem" />
                  {i % 2 === 0 && <Skeleton width="60%" height="1rem" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="message-area__empty">No messages yet. Start the conversation!</p>
        )}

        {(() => {
          let displayedMessages = messages;
          if (showPinnedOnly) displayedMessages = displayedMessages.filter(m => m.is_pinned);
          if (searchQuery) displayedMessages = displayedMessages.filter(m => m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()));

          if (!loading && messages.length > 0 && displayedMessages.length === 0) {
            return <p className="message-area__empty">No messages match your criteria.</p>;
          }

          return displayedMessages.map((msg, i) => {
          if (msg.is_system) {
            const isEnd = msg.content.toLowerCase().includes("ended");
            return (
              <div key={msg.id} className="message-area__system-msg">
                <div className="message-area__system-msg-content">
                  {isEnd
                    ? <PhoneOff size={13} className="message-area__system-msg-icon message-area__system-msg-icon--end" />
                    : <PhoneCall size={13} className="message-area__system-msg-icon message-area__system-msg-icon--start" />
                  }
                  <span>{msg.content}</span>
                </div>
              </div>
            );
          }

          const sender = usersMap[msg.sender];
          const username = sender?.username || (msg.sender === profile?.id ? profile.username : "User");
          const isSelf = msg.sender === profile?.id;
          const prevSame = i > 0 && messages[i - 1].sender === msg.sender;
          const msgReactions = groupReactions(reactionsByMessage[msg.id] || [], usersMap);
          const msgAttachments = attachmentsByMessage[msg.id] || [];
          const displayContent = getCleanMessageContent(msg.content, msgAttachments);
          const myReaction = (reactionsByMessage[msg.id] || []).find(
            (r) => Number(r.user) === Number(profile?.id)
          );

          return (
            <div
              key={msg.id}
              className={`message-area__message ${isSelf ? "message-area__message--self" : ""} ${
                prevSame ? "message-area__message--compact" : ""
              } ${msgReactions.length > 0 ? "message-area__message--has-reactions" : ""} ${msg.isOptimistic ? "message-area__message--optimistic" : ""}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {!prevSame && (
                <div
                  className="message-area__avatar"
                  style={!sender?.avatar_url ? { background: getAvatarColor(username) } : { overflow: 'hidden' }}
                >
                  {sender?.avatar_url ? (
                    <img src={sender.avatar_url} alt={username} className="message-area__avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '7px' }} />
                  ) : (
                    getInitials(username)
                  )}
                </div>
              )}
              <div className="message-area__bubble-wrap">
                {hoveredId === msg.id && (
                  <div className="message-area__reaction-picker">
                    <button
                      type="button"
                      className="message-area__reaction-pick"
                      title={msg.is_pinned ? "Unpin message" : "Pin message"}
                      onClick={() => onPin && onPin(msg.id)}
                    >
                      <Pin size={14} className={msg.is_pinned ? "pinned-active" : ""} />
                    </button>
                    <div className="message-area__reaction-picker-divider" />
                    {reactionTypes.map((type) => {
                      const isActive = myReaction?.reaction_type === type;
                      return (
                      <button
                        key={type}
                        type="button"
                        className={`message-area__reaction-pick ${
                          isActive ? "message-area__reaction-pick--active" : ""
                        }`}
                        title={isActive ? "Remove reaction" : `React with ${reactionEmoji[type]}`}
                        onClick={() => handleReact(msg.id, type)}
                        disabled={reactingId === msg.id}
                      >
                        {reactionEmoji[type]}
                      </button>
                    );})}
                    {isSelf && (
                      <>
                        <div className="message-area__reaction-picker-divider" />
                        <button
                          type="button"
                          className="message-area__reaction-pick"
                          title={msgAttachments.length > 0 ? "Editing attachments not supported (like WhatsApp/Teams)" : "Edit message"}
                          onClick={() => {
                            if (msgAttachments.length === 0) {
                              setEditingMessageId(msg.id);
                              setEditingText(displayContent);
                            }
                          }}
                          disabled={msgAttachments.length > 0}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="message-area__reaction-pick message-area__reaction-pick--danger"
                          title="Delete message"
                          onClick={() => handleDeleteClick(msg.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="message-area__bubble">
                  {msg.is_pinned && (
                    <div className="message-area__pin-indicator">
                      <Pin size={12} /> Pinned
                    </div>
                  )}
                  {!prevSame && (
                    <div className="message-area__meta">
                      <span className="message-area__author">{isSelf ? "You" : username}</span>
                      <span className="message-area__time">{formatMessageTime(msg.created_at)}</span>
                    </div>
                  )}
                  {editingMessageId === msg.id ? (
                    <div className="message-area__edit-form">
                      <textarea
                        className="message-area__edit-input"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(msg.id);
                          } else if (e.key === "Escape") {
                            setEditingMessageId(null);
                          }
                        }}
                      />
                      <div className="message-area__edit-actions">
                        <button
                          type="button"
                          className="vtl-btn vtl-btn--ghost vtl-btn--xs"
                          onClick={() => setEditingMessageId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="vtl-btn vtl-btn--primary vtl-btn--xs"
                          onClick={() => handleSaveEdit(msg.id)}
                          disabled={!editingText.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {displayContent && <p className="message-area__text">{renderContentWithMentions(displayContent, usersMap, onDMSelect)}</p>}
                      {msg.isError && (
                        <div className="message-area__error-state">
                          <AlertCircle size={14} className="message-area__error-icon" />
                          <span>Message failed to send. Please try again.</span>
                        </div>
                      )}
                    </>
                  )}

                  {msgAttachments.length > 0 && (
                    <>
                      <div className="message-area__attachments">
                        {msgAttachments.map((att) => {
                          const url = att.file_url || getMediaUrl(att.file);
                          const name = getFileName(att.file);
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
                          return (
                            <div
                              key={att.id}
                              className={`message-area__attachment-wrapper ${
                                isImage ? "message-area__attachment-wrapper--image" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className={`message-area__attachment ${
                                  isImage ? "message-area__attachment--image" : ""
                                }`}
                                title="Click to preview in-app"
                              >
                                {isImage ? (
                                  <img src={url} alt={name} loading="lazy" />
                                ) : (
                                  <>
                                    <Paperclip size={14} />
                                    <span>{name}</span>
                                    <Eye size={12} className="message-area__attachment-eye" />
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                className="message-area__attachment-download-btn"
                                title="Download file"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(url, name);
                                }}
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="message-area__attachment-note">
                        Attachments cannot be edited (like WhatsApp/Teams).
                      </p>
                    </>
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
                        <span className="message-area__reaction-emoji">{reactionEmoji[r.type] || "👍"}</span>
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
        });
        })()}
        <div ref={bottomRef} />

        {/* Typing Indicator */}
        {Object.keys(typingUsers).length > 0 && (() => {
          const names = Object.values(typingUsers).map((u) => u.username);
          const label =
            names.length === 1
              ? `${names[0]} is typing`
              : names.length === 2
              ? `${names[0]} and ${names[1]} are typing`
              : `${names[0]} and ${names.length - 1} others are typing`;
          return (
            <div className="message-area__typing">
              <span className="message-area__typing-label">{label}</span>
              <span className="message-area__typing-dots">
                <span /><span /><span />
              </span>
            </div>
          );
        })()}
      </div>

      {previewAttachment && createPortal(
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onDownload={handleDownload}
        />,
        document.body
      )}
    </div>
  );
}

const getCleanMessageContent = (content, attachments) => {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("📎")) {
    return "";
  }
  if (attachments && attachments.length > 0) {
    const isOnlyFilename = attachments.some(att => {
      const name = getFileName(att.file);
      return trimmed === name || trimmed === `Shared ${name}` || trimmed === `📎 ${name}`;
    });
    if (isOnlyFilename) return "";
  }
  return content;
};

function handleOpenInNewTab(fileUrl) {
  window.open(fileUrl, "_blank");
}


function AttachmentPreviewModal({ attachment, onClose, onDownload }) {
  const url = attachment.file_url || getMediaUrl(attachment.file);
  const name = getFileName(attachment.file);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isVideo = /\.(mp4|webm|ogg)$/i.test(name);
  const isAudio = /\.(mp3|wav|ogg)$/i.test(name);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="message-area__preview-modal" onClick={onClose}>
      <div className="message-area__preview-content" onClick={(e) => e.stopPropagation()}>
        <div className="message-area__preview-header">
          <div className="message-area__preview-filename">
            <Paperclip size={16} />
            <span>{name}</span>
          </div>
          <div className="message-area__preview-actions">
            <button
              type="button"
              className="vtl-btn vtl-btn--ghost vtl-btn--xs"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "inherit" }}
              onClick={() => handleOpenInNewTab(url, name)}
              title="Open in new tab"
            >
              <ExternalLink size={14} />
              <span>Open in new tab</span>
            </button>
            <button
              type="button"
              className="vtl-btn vtl-btn--primary vtl-btn--xs"
              onClick={() => onDownload(url, name)}
              title="Download file"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="vtl-btn vtl-btn--ghost vtl-btn--xs message-area__preview-close"
              onClick={onClose}
              title="Close preview"
            >
              <X size={16} />
              <span>Close</span>
            </button>
          </div>
        </div>

        <div className="message-area__preview-body">
          {isImage ? (
            <img src={url} alt={name} className="message-area__preview-media" />
          ) : isVideo ? (
            <video src={url} controls autoPlay className="message-area__preview-media" />
          ) : isAudio ? (
            <audio src={url} controls className="message-area__preview-audio" />
          ) : (
            <div className="message-area__preview-fallback">
              <Paperclip size={64} className="message-area__preview-fallback-icon" />
              <h3>{name}</h3>
              <p>Preview not available for this file type.</p>
              <div className="message-area__preview-fallback-buttons">
                <button
                  type="button"
                  className="vtl-btn vtl-btn--primary"
                  onClick={() => onDownload(url, name)}
                >
                  <Download size={16} />
                  Download File
                </button>
                <button
                  type="button"
                  className="vtl-btn vtl-btn--ghost"
                  onClick={() => handleOpenInNewTab(url, name)}
                >
                  <ExternalLink size={16} />
                  Open in New Tab
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
