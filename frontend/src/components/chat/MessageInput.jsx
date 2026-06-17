import { useState } from "react";
import { Plus, Smile, AtSign, Paperclip, Send, Loader2 } from "lucide-react";
import "./MessageInput.scss";

export default function MessageInput({ channelName = "general", onSend, disabled, sending }) {
  const [content, setContent] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || disabled || sending) return;
    const text = content.trim();
    setContent("");
    await onSend?.(text);
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <div className="message-input__bar">
        <button type="button" className="message-input__attach" title="Attach file">
          <Plus size={20} />
        </button>

        <div className="message-input__field">
          <input
            type="text"
            placeholder={disabled ? "Select a channel to message" : `Message #${channelName}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={disabled || sending}
          />
          <div className="message-input__actions">
            <button type="button" title="Emoji"><Smile size={18} /></button>
            <button type="button" title="Mention"><AtSign size={18} /></button>
            <button type="button" title="Attach"><Paperclip size={18} /></button>
          </div>
        </div>

        <button
          type="submit"
          className="message-input__send"
          title="Send"
          disabled={!content.trim() || disabled || sending}
        >
          {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
}
