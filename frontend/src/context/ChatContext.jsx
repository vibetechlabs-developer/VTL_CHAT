/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import * as workspaceApi from "../services/workspaceApi";
import { fetchCursorPage, toChronological } from "../utils/pagination";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);

  const fetchChannelMessages = async (channelId) => {
    const page = await fetchCursorPage(() => workspaceApi.getMessages(channelId));
    return {
      results: toChronological(page.results),
      next: page.next,
      previous: page.previous,
    };
  };

  const postMessage = async (channelId, content, clientUuid) => {
    const payload = { channel: channelId, content };
    if (clientUuid) payload.client_uuid = clientUuid;
    const res = await workspaceApi.sendMessage(payload);
    return res.data;
  };

  const editMessage = async (messageId, content) => {
    const res = await workspaceApi.editMessage(messageId, { content });
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.data : m)));
    return res.data;
  };

  const deleteMessage = async (messageId) => {
    await workspaceApi.deleteMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const clearChannelChat = async (channelId) => {
    await workspaceApi.clearChat(channelId);
    setMessages((prev) => prev.filter((m) => m.channel !== channelId));
  };

  const pinMessage = async (messageId) => {
    const res = await workspaceApi.pinMessage(messageId);
    return res.data;
  };

  const toggleReaction = async (messageId, reactionType, profileId) => {
    const existing = reactions.find(
      (r) =>
        Number(r.message) === Number(messageId) &&
        Number(r.user) === Number(profileId)
    );

    if (existing?.reaction_type === reactionType) {
      await workspaceApi.removeReaction(existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      return null;
    }

    if (existing) {
      const res = await workspaceApi.updateReaction(existing.id, {
        reaction_type: reactionType,
      });
      setReactions((prev) => prev.map((r) => (r.id === existing.id ? res.data : r)));
      return res.data;
    }

    const res = await workspaceApi.addReaction({
      message: messageId,
      reaction_type: reactionType,
    });
    setReactions((prev) => [...prev, res.data]);
    return res.data;
  };

  const uploadMessageAttachment = async (messageId, file) => {
    const res = await workspaceApi.uploadAttachment(messageId, file);
    return res.data;
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        reactions,
        setMessages,
        setReactions,
        fetchChannelMessages,
        postMessage,
        editMessage,
        deleteMessage,
        clearChannelChat,
        pinMessage,
        toggleReaction,
        uploadMessageAttachment,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
