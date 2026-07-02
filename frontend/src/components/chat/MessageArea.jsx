import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import {
  formatMessageTime,
  getInitials,
  getAvatarColor,
  groupReactions,
  REACTION_EMOJI,
  REACTION_TYPES,
  getMediaUrl,
  getFileName,
  getChannelDisplayName,
} from "../../utils/helpers";
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
    return part;
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
  onReact,
  reactingId,
  onPin,
  onEditMessage,
  onDeleteMessage,
  onToggleMembers,
  onClearChat,
  onDMSelect,
}) {
  const confirm = useConfirm();
  const bottomRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
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
            className={showSearchInput ? "active" : ""}
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              if (showSearchInput) setSearchQuery("");
            }}
          >
            <Search size={18} />
          </button>
          <button 
            type="button" 
            title="Pinned"
            className={showPinnedOnly ? "active" : ""}
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
          >
            <Pin size={18} />
          </button>
          <button
            type="button"
            title="Notifications"
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
          <button type="button" title="Members" onClick={onToggleMembers}><Users size={18} /></button>
          {onClearChat && (
            <button
              type="button"
              title="Clear Chat"
              onClick={handleClearClick}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            title="More"
            onClick={() =>
              confirm({
                title: "More Options",
                message: "More options coming soon!",
                confirmText: "OK",
                cancelText: null,
              })
            }
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <div className="message-area__messages">
        <div className="message-area__welcome">
          <div className="message-area__welcome-icon">
            {channel?.channel_type === "DIRECT" ? (
              <div
                className="message-area__avatar message-area__avatar--dm"
                style={{ background: getAvatarColor(channelName), width: 64, height: 64, fontSize: '1.5rem', marginBottom: 0 }}
              >
                {getInitials(channelName)}
              </div>
            ) : (
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
          <div className="message-area__loading">
            <Loader2 size={24} className="spin" />
            <span>Loading messages...</span>
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
                  style={{ background: getAvatarColor(username) }}
                >
                  {getInitials(username)}
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
                    displayContent && <p className="message-area__text">{renderContentWithMentions(displayContent, usersMap, onDMSelect)}</p>
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
        });
        })()}
        <div ref={bottomRef} />
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
