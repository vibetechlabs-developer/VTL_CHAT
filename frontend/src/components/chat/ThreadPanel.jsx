import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { formatMessageTime, getAvatarColor, getInitials, parseMentions } from "../../utils/helpers";
import { fetchAllCursorPages } from "../../utils/pagination";
import logger from "../../utils/logger";
import "./ThreadPanel.scss";
import * as workspaceApi from "../../services/workspaceApi";

export default function ThreadPanel({
  parentMessage,
  onClose,
  usersMap = {},
  profile,
  onSendReply,
}) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchReplies = async () => {
      try {
        setLoading(true);
        // workspaceApi.getMessages expects (channelId, parentId) we might need to add parentId arg
        // wait, getMessages signature in workspaceApi might be (channelId) only!
        // We will need to update workspaceApi.js
        const list = await fetchAllCursorPages((url) =>
          workspaceApi.getMessages(parentMessage.channel, parentMessage.id, url)
        );
        if (active) {
          setReplies(list);
        }
      } catch (err) {
        logger.error("Failed to fetch replies", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (parentMessage) {
      fetchReplies();
    }
    return () => {
      active = false;
    };
  }, [parentMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      const res = await onSendReply(replyContent, parentMessage.id);
      if (res) {
        setReplies((prev) => [...prev, res]);
        setReplyContent("");
      }
    } catch (err) {
      logger.error(err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (msg, isParent = false) => {
    const sender = usersMap[msg.sender];
    const username = sender?.username || (msg.sender === profile?.id ? profile.username : "User");
    const isSelf = msg.sender === profile?.id;

    return (
      <div key={msg.id} className={`thread-message ${isParent ? "thread-message--parent" : ""} ${isSelf ? "thread-message--self" : ""}`}>
        <div
          className="thread-message__avatar"
          style={{ background: getAvatarColor(username) }}
        >
          {getInitials(username)}
        </div>
        <div className="thread-message__content">
          <div className="thread-message__meta">
            <span className="thread-message__author">{isSelf ? "You" : username}</span>
            <span className="thread-message__time">{formatMessageTime(msg.created_at)}</span>
          </div>
          <p className="thread-message__text">{parseMentions(msg.content, usersMap)}</p>
        </div>
      </div>
    );
  };

  if (!parentMessage) return null;

  return (
    <div className="thread-panel">
      <div className="thread-panel__header">
        <h3>Thread</h3>
        <span className="thread-panel__subtitle">
          {parentMessage.channelName ? `#${parentMessage.channelName}` : ""}
        </span>
        <button className="vtl-btn vtl-btn--ghost vtl-btn--icon" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="thread-panel__scroll">
        {renderMessage(parentMessage, true)}

        <div className="thread-panel__divider">
          <span>{replies.length} replies</span>
        </div>

        {loading ? (
          <div className="thread-panel__loading">
            <Loader2 size={24} className="spin" />
          </div>
        ) : (
          <div className="thread-panel__replies">
            {replies.map((msg) => renderMessage(msg))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="thread-panel__input-area">
        <form onSubmit={handleSend} className="thread-panel__form">
          <input
            type="text"
            placeholder="Reply to thread..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={sending}
          />
          <button type="submit" disabled={!replyContent.trim() || sending} className="vtl-btn vtl-btn--primary vtl-btn--icon">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
