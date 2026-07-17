import { useEffect, useMemo, useRef, useState } from "react";
import { Smile, AtSign, Paperclip, Send, Loader2, X, Users } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { ALLOWED_FILE_ACCEPT, validateFile } from "../../utils/fileUpload";
import "./MessageInput.scss";

const COMMON_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "👍", "👎", "❤️", "🔥", "🎉", "👏", "🙌", "💡", "🚀", "✨"
];

export default function MessageInput({
  channelName = "general",
  onSend,
  onTyping,
  disabled,
  sending,
  members = [],
  teams = [],
  usersMap = {},
}) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const toast = useToast();

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
        setShowMentions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!content.trim() && !file) || disabled || sending) return;
    const text = content.trim();
    const attachment = file;
    setContent("");
    setFile(null);
    setShowEmojiPicker(false);
    setShowMentions(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await onSend?.(text, attachment);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const error = validateFile(selected);
    if (error) {
      toast.error(error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setContent(val);

    // Typing indicator logic
    if (onTyping) {
      const now = Date.now();
      if (now - lastTypingSentRef.current >= 2000) {
        onTyping(true);
        lastTypingSentRef.current = now;
      }
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    }

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Trigger mentions if there are no spaces in the query segment
      if (!textAfterAt.includes(" ")) {
        setShowMentions(true);
        setMentionQuery(textAfterAt.toLowerCase());
        setMentionIndex(lastAtIndex);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current;
    if (!input) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);
    setContent(newContent);
    setShowEmojiPicker(false);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSuggestionSelect = (suggestion) => {
    const input = inputRef.current;
    if (!input) return;
    const start = mentionIndex;
    const selectionStart = input.selectionStart;
    const mentionText = `@${suggestion.name} `;
    const newContent = content.substring(0, start) + mentionText + content.substring(selectionStart);
    setContent(newContent);
    setShowMentions(false);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + mentionText.length, start + mentionText.length);
    }, 0);
  };

  const handleMentionButtonClick = () => {
    setShowEmojiPicker(false);
    const input = inputRef.current;
    if (!input) {
      setContent((prev) => prev + "@");
      setShowMentions(true);
      setMentionQuery("");
      setMentionIndex(content.length);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const newContent = content.substring(0, start) + "@" + content.substring(end);
    setContent(newContent);
    setMentionIndex(start);
    setMentionQuery("");
    setShowMentions(true);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    }, 0);
  };

  const filteredSuggestions = useMemo(() => {
    const suggestions = [];

    // 1. Add Team/Group suggestions
    if (teams && Array.isArray(teams)) {
      teams.forEach((t) => {
        suggestions.push({
          type: "team",
          id: t.id,
          name: t.name,
          details: "Group Mention",
        });
      });
    }

    // 2. Add Member suggestions
    if (members && Array.isArray(members)) {
      members.forEach((m) => {
        const u = usersMap?.[m.user];
        if (u) {
          suggestions.push({
            type: "user",
            id: u.id,
            name: u.username,
            details: m.role === "ADMIN" ? "Admin" : "Member",
          });
        }
      });
    }

    if (!mentionQuery) return suggestions.slice(0, 10);
    return suggestions
      .filter((s) => s.name.toLowerCase().includes(mentionQuery))
      .slice(0, 10);
  }, [teams, members, usersMap, mentionQuery]);

  return (
    <form ref={containerRef} className="message-input" onSubmit={handleSubmit}>
      {file && (
        <div className="message-input__file-preview">
          <Paperclip size={14} />
          <span>{file.name}</span>
          <button type="button" onClick={clearFile} aria-label="Remove file">
            <X size={14} />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="message-input__emoji-picker">
          <div className="message-input__emoji-picker-header">Popular Emojis</div>
          <div className="message-input__emoji-picker-grid">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="message-input__emoji-picker-emoji"
                onClick={() => handleEmojiSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {showMentions && filteredSuggestions.length > 0 && (
        <div className="message-input__mention-dropdown">
          <div className="message-input__mention-dropdown-title">Mentions suggestions</div>
          {filteredSuggestions.map((suggestion) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              type="button"
              className="message-input__mention-dropdown-item"
              onClick={() => handleSuggestionSelect(suggestion)}
            >
              {suggestion.type === "team" ? (
                <Users size={14} className="message-input__mention-dropdown-item-icon" />
              ) : (
                <AtSign size={14} className="message-input__mention-dropdown-item-icon" />
              )}
              <div className="message-input__mention-dropdown-item-info">
                <span className="name">{suggestion.name}</span>
                <span className="details">{suggestion.details}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="message-input__bar">
        <input
          ref={fileInputRef}
          type="file"
          className="message-input__file-input"
          accept={ALLOWED_FILE_ACCEPT}
          onChange={handleFileChange}
          disabled={disabled || sending}
        />
        <button
          type="button"
          className="message-input__attach"
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
        >
          <Paperclip size={20} />
        </button>

        <div className="message-input__field">
          <input
            ref={inputRef}
            type="text"
            placeholder={disabled ? "Select a channel to message" : `Message #${channelName}`}
            value={content}
            onChange={handleTextChange}
            disabled={disabled || sending}
          />
          <div className="message-input__actions">
            <button
              type="button"
              title="Emoji"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowMentions(false);
              }}
              disabled={disabled || sending}
            >
              <Smile size={18} style={{ color: showEmojiPicker ? "#7C3AED" : "inherit" }} />
            </button>
            <button
              type="button"
              title="Mention"
              onClick={handleMentionButtonClick}
              disabled={disabled || sending}
            >
              <AtSign size={18} style={{ color: showMentions ? "#7C3AED" : "inherit" }} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="message-input__send"
          title="Send"
          disabled={(!content.trim() && !file) || disabled || sending}
        >
          {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
}
