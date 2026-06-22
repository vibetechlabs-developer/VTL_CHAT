import { useRef, useState } from "react";
import { Smile, AtSign, Paperclip, Send, Loader2, X } from "lucide-react";
import "./MessageInput.scss";

export default function MessageInput({
  channelName = "general",
  onSend,
  disabled,
  sending,
}) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!content.trim() && !file) || disabled || sending) return;
    const text = content.trim();
    const attachment = file;
    setContent("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await onSend?.(text, attachment);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      {file && (
        <div className="message-input__file-preview">
          <Paperclip size={14} />
          <span>{file.name}</span>
          <button type="button" onClick={clearFile} aria-label="Remove file">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="message-input__bar">
        <input
          ref={fileInputRef}
          type="file"
          className="message-input__file-input"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
            type="text"
            placeholder={disabled ? "Select a channel to message" : `Message #${channelName}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={disabled || sending}
          />
          <div className="message-input__actions">
            <button type="button" title="Emoji"><Smile size={18} /></button>
            <button type="button" title="Mention"><AtSign size={18} /></button>
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
