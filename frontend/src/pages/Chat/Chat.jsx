import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/vtl/AppLayout";
import MessageArea from "../../components/chat/MessageArea";
import MessageInput from "../../components/chat/MessageInput";
import MemberPanel from "../../components/chat/MemberPanel";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useChatSocket } from "../../hooks/useChatSocket";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage, getChannelDisplayName } from "../../utils/helpers";
import "./Chat.scss";

export default function Chat() {
  const { teamId, channelId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    teams,
    channels,
    users,
    usersMap,
    teamMembers,
    reactions,
    unreadNotificationCount,
    fetchChannelMessages,
    postMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    addReaction,
    uploadMessageAttachment,
  } = useWorkspace();

  const [channelMessages, setChannelMessages] = useState([]);
  const [channelAttachments, setChannelAttachments] = useState([]);
  const [channelReactionsLocal, setChannelReactionsLocal] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [showMembers, setShowMembers] = useState(true);

  // Unified parameter resolution
  const currentChannelId = useMemo(() => {
    if (channelId) return Number(channelId);
    
    if (location.pathname.startsWith("/chat")) {
      const dmChannels = channels.filter((c) => c.channel_type === "DIRECT");
      return dmChannels.length > 0 ? dmChannels[0].id : null;
    }
    
    if (location.pathname.startsWith("/teams")) {
      if (teams.length > 0) {
        const teamCh = channels.filter((c) => c.team === teams[0].id && c.channel_type !== "DIRECT");
        return teamCh.length > 0 ? teamCh[0].id : null;
      }
    }
    
    return null;
  }, [channelId, location.pathname, channels, teams]);

  const currentTeamId = useMemo(() => {
    if (teamId) return Number(teamId);
    const activeChannel = channels.find((c) => c.id === currentChannelId);
    return activeChannel?.team || (teams.length ? teams[0].id : null);
  }, [teamId, currentChannelId, channels, teams]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!currentChannelId) return;
      setMessagesLoading(true);
      try {
        const [messagesRes, attachmentsRes, reactionsRes] = await Promise.all([
          fetchChannelMessages(currentChannelId),
          workspaceApi.getAttachments(currentChannelId).then((r) => r.data).catch(() => []),
          workspaceApi.getReactions(currentChannelId).then((r) => r.data).catch(() => []),
        ]);
        if (!active) return;
        const messagesList = Array.isArray(messagesRes) ? messagesRes : (messagesRes?.results || []);
        setChannelMessages(messagesList);
        setChannelAttachments(attachmentsRes);
        setChannelReactionsLocal(reactionsRes);
      } catch (err) {
        console.error(extractErrorMessage(err));
      } finally {
        if (active) setMessagesLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [currentChannelId, fetchChannelMessages]);

  const handleSocketEvent = useCallback(
    (payload) => {
      if (!payload?.type) return;

      if (payload.type === "message" && payload.payload) {
        setChannelMessages((prev) => {
          if (prev.some((m) => m.id === payload.payload.id)) return prev;
          return [...prev, payload.payload];
        });
        return;
      }

      if (payload.type === "message_updated" && payload.payload) {
        setChannelMessages((prev) =>
          prev.map((m) => (m.id === payload.payload.id ? payload.payload : m))
        );
        return;
      }

      if (payload.type === "message_deleted" && payload.payload) {
        setChannelMessages((prev) => prev.filter((m) => m.id !== payload.payload.id));
        return;
      }

      if (payload.type === "attachment" && payload.payload) {
        setChannelAttachments((prev) => {
          if (prev.some((a) => a.id === payload.payload.id)) return prev;
          return [...prev, payload.payload];
        });
        return;
      }

      if (payload.type === "reaction" && payload.payload) {
        if (payload.action === "delete") {
          setChannelReactionsLocal((prev) =>
            prev.filter((r) => r.id !== payload.payload.id)
          );
          return;
        }
        setChannelReactionsLocal((prev) => {
          const idx = prev.findIndex((r) => r.id === payload.payload.id);
          if (idx >= 0) {
            return prev.map((r) => (r.id === payload.payload.id ? payload.payload : r));
          }
          return [...prev, payload.payload];
        });
      }
    },
    []
  );

  const handleReconnect = useCallback(async () => {
    if (!currentChannelId) return;
    try {
      const [messagesRes, attachmentsRes, reactionsRes] = await Promise.all([
        fetchChannelMessages(currentChannelId),
        workspaceApi.getAttachments(currentChannelId).then((r) => r.data).catch(() => []),
        workspaceApi.getReactions(currentChannelId).then((r) => r.data).catch(() => []),
      ]);
      const messagesList = Array.isArray(messagesRes) ? messagesRes : (messagesRes?.results || []);
      setChannelMessages(messagesList);
      setChannelAttachments(attachmentsRes);
      setChannelReactionsLocal(reactionsRes);
    } catch (err) {
      console.error("Failed to resync messages on reconnect:", err);
    }
  }, [currentChannelId, fetchChannelMessages]);

  const { connectionStatus } = useChatSocket(currentChannelId, handleSocketEvent, handleReconnect);

  const activeChannel = channels.find((c) => c.id === currentChannelId);
  const activeTeam = teams.find((t) => t.id === currentTeamId);
  const teamMembersList = teamMembers.filter((m) => m.team === currentTeamId);

  const channelReactions = useMemo(() => {
    const messageIds = new Set(channelMessages.map((m) => m.id));
    const merged = reactions.filter((r) => messageIds.has(r.message));
    channelReactionsLocal.forEach((r) => {
      if (!messageIds.has(r.message)) return;
      const idx = merged.findIndex((x) => x.id === r.id);
      if (idx >= 0) merged[idx] = r;
      else merged.push(r);
    });
    return merged;
  }, [reactions, channelReactionsLocal, channelMessages]);

  const handleSend = async (content, file) => {
    if (!currentChannelId) return;
    setSending(true);
    
    const text = content.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: text || (file ? `📎 ${file.name}` : ""),
      channel: currentChannelId,
      sender: profile?.id,
      created_at: new Date().toISOString(),
      is_pinned: false,
      isOptimistic: true,
    };
    
    setChannelMessages((prev) => [...prev, optimisticMsg]);

    try {
      const msg = await postMessage(currentChannelId, text);
      
      setChannelMessages((prev) => {
        const hasRealMsg = prev.some((m) => m.id === msg.id);
        if (hasRealMsg) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? msg : m));
      });

      if (file) {
        const att = await uploadMessageAttachment(msg.id, file);
        if (att) {
          setChannelAttachments((prev) => {
            if (prev.some((a) => a.id === att.id)) return prev;
            return [...prev, att];
          });
        }
      }
    } catch (err) {
      console.error(extractErrorMessage(err));
      setChannelMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId, reactionType) => {
    setReactingId(messageId);
    try {
      await addReaction(messageId, reactionType);
    } catch (err) {
      console.error(extractErrorMessage(err));
    } finally {
      setReactingId(null);
    }
  };

  const handlePin = async (messageId) => {
    try {
      await pinMessage(messageId);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      await editMessage(messageId, newContent);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  const handleDMSelect = async (userId) => {
    try {
      const dmChannel = await createDirectMessageChannel(userId);
      navigate(`/chat/dm/${dmChannel.id}`);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  return (
    <AppLayout
      title={location.pathname.startsWith("/chat") ? "Chat" : "Teams"}
      subtitle="Real-time collaboration workspace"
      showSearch={false}
      fullBleed
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="chat-workspace">
        <div className="chat-workspace__main">
          {connectionStatus !== "connected" && connectionStatus !== "disconnected" && (
            <div className={`chat-workspace__connection-status chat-workspace__connection-status--${connectionStatus}`}>
              {connectionStatus === "connecting" ? "Connecting to chat..." : "Connection lost. Reconnecting..."}
            </div>
          )}
          <MessageArea
            channel={activeChannel}
            messages={channelMessages}
            usersMap={usersMap}
            profile={profile}
            reactions={channelReactions}
            attachments={channelAttachments}
            loading={messagesLoading}
            onReact={handleReact}
            reactingId={reactingId}
            onPin={handlePin}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleMembers={() => setShowMembers(!showMembers)}
          />
          <MessageInput
            channelName={getChannelDisplayName(activeChannel, profile?.id, usersMap)}
            onSend={handleSend}
            disabled={!currentChannelId}
            sending={sending}
            members={teamMembersList}
            teams={teams}
            usersMap={usersMap}
          />
        </div>

        {showMembers && activeChannel?.channel_type !== "DIRECT" && (
          <MemberPanel
            members={teamMembersList}
            usersMap={usersMap}
            profile={profile}
            teamName={activeTeam?.name}
            onDMSelect={handleDMSelect}
          />
        )}
      </div>
    </AppLayout>
  );
}
