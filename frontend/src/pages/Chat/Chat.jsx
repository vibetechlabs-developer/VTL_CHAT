import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/vtl/AppLayout";
import MessageArea from "../../components/chat/MessageArea";
import MessageInput from "../../components/chat/MessageInput";
import MemberPanel from "../../components/chat/MemberPanel";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useChatSocket } from "../../hooks/useChatSocket";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage, getChannelDisplayName } from "../../utils/helpers";
import {
  fetchAllCursorPages,
  fetchCursorPage,
  prependById,
  toChronological,
} from "../../utils/pagination";
import logger from "../../utils/logger";
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
    usersMap,
    teamMembers,
    reactions,
    unreadNotificationCount,
    fetchChannelMessages,
    postMessage,
    editMessage,
    deleteMessage,
    clearChannelChat,
    pinMessage,
    addReaction,
    uploadMessageAttachment,
    createDirectMessageChannel,
    leaveTeam,
    removeTeamMember,
  } = useWorkspace();

  const [channelMessages, setChannelMessages] = useState([]);
  const [channelAttachments, setChannelAttachments] = useState([]);
  const [channelReactionsLocal, setChannelReactionsLocal] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [olderMessagesUrl, setOlderMessagesUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [showMembers, setShowMembers] = useState(true);
  // typing: { [userId]: { username, timeout } }
  const [typingUsers, setTypingUsers] = useState({});

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

  const loadChannelData = useCallback(async () => {
    if (!currentChannelId) return;
    const [messagesPage, attachmentsRes, reactionsRes] = await Promise.all([
      fetchChannelMessages(currentChannelId),
      fetchAllCursorPages((url) => workspaceApi.getAttachments(currentChannelId, url)).catch(
        () => []
      ),
      fetchAllCursorPages((url) => workspaceApi.getReactions(currentChannelId, url)).catch(
        () => []
      ),
    ]);
    setChannelMessages(messagesPage.results);
    setOlderMessagesUrl(messagesPage.next);
    setChannelAttachments(attachmentsRes);
    setChannelReactionsLocal(reactionsRes);
    return messagesPage.results;
  }, [currentChannelId, fetchChannelMessages]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!currentChannelId) return;
      setMessagesLoading(true);
      setOlderMessagesUrl(null);
      try {
        const messagesList = await loadChannelData();
        if (!active) return;

        if (messagesList.length > 0) {
          const latestMsg = messagesList[messagesList.length - 1];
          if (latestMsg.sender !== profile?.id) {
            workspaceApi.sendReadReceipt(currentChannelId, latestMsg.id).catch(() => {});
          }
        }
      } catch (err) {
        logger.error(extractErrorMessage(err));
      } finally {
        if (active) setMessagesLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [currentChannelId, loadChannelData, profile?.id]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!olderMessagesUrl || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const page = await fetchCursorPage(() =>
        workspaceApi.getMessages(null, null, olderMessagesUrl)
      );
      const older = toChronological(page.results);
      setChannelMessages((prev) => prependById(prev, older));
      setOlderMessagesUrl(page.next);
    } catch (err) {
      logger.error("Failed to load older messages:", extractErrorMessage(err));
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [olderMessagesUrl, loadingOlderMessages]);

  const handleSocketEvent = useCallback(
    (payload) => {
      if (!payload?.type) return;

      if (payload.type === "message" && payload.payload) {
        const msg = payload.payload;
        setChannelMessages((prev) => {
          // First check if this WS event matches an optimistic placeholder we sent.
          // The client_uuid is echoed by the server in both REST response AND WS
          // broadcast, so a match means we already have this message (possibly as
          // a placeholder). Replace-in-place rather than appending a duplicate.
          const uuidIdx = msg.client_uuid
            ? prev.findIndex((m) => m.client_uuid === msg.client_uuid)
            : -1;
          if (uuidIdx >= 0) {
            // Replace placeholder with the authoritative server message.
            const arr = [...prev];
            arr[uuidIdx] = msg;
            return arr;
          }
          // Fall back to id deduplication for messages we didn't send ourselves.
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Send read receipt if received message is from another user
        if (msg.sender !== profile?.id) {
          workspaceApi.sendReadReceipt(currentChannelId, msg.id).catch(() => {});
        }
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
      if (payload.type === "chat_cleared" && payload.payload) {
        if (Number(payload.payload.channel) === Number(currentChannelId)) {
          setChannelMessages([]);
          setChannelAttachments([]);
          setChannelReactionsLocal([]);
        }
        return;
      }
      if (payload.type === "typing") {
        const { user_id, username, is_typing } = payload;
        // Don't show indicator for our own user
        if (user_id === profile?.id) return;
        setTypingUsers((prev) => {
          if (!is_typing) {
            const { [user_id]: _removed, ...rest } = prev;
            return rest;
          }
          // auto-clear after 3.5s in case disconnect event is missed
          if (prev[user_id]?.clearTimeout) clearTimeout(prev[user_id].clearTimeout);
          const timer = setTimeout(() => {
            setTypingUsers((p) => {
              const { [user_id]: _r, ...r } = p; return r;
            });
          }, 3500);
          return { ...prev, [user_id]: { username, clearTimeout: timer } };
        });
        return;
      }
    },    [currentChannelId]
  );

  const handleReconnect = useCallback(async () => {
    if (!currentChannelId) return;
    try {
      await loadChannelData();
    } catch (err) {
      logger.error("Failed to resync messages on reconnect:", err);
    }
  }, [currentChannelId, loadChannelData]);

  const { connectionStatus, sendSocketMessage } = useChatSocket(currentChannelId, handleSocketEvent, handleReconnect);

  const typingThrottleRef = useRef(null);
  const typingStopRef = useRef(null);

  const handleTyping = useCallback((isTyping) => {
    if (!isTyping) {
      // User explicitly stopped typing (blur, submit, etc.)
      clearTimeout(typingThrottleRef.current);
      clearTimeout(typingStopRef.current);
      typingThrottleRef.current = null;
      sendSocketMessage({ action: "typing", is_typing: false });
      return;
    }

    // Throttle: only send "typing" once every 2.5s
    if (!typingThrottleRef.current) {
      sendSocketMessage({ action: "typing", is_typing: true });
      typingThrottleRef.current = setTimeout(() => {
        typingThrottleRef.current = null;
      }, 2500);
    }

    // Auto-stop after 3s of no keystrokes
    clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
      sendSocketMessage({ action: "typing", is_typing: false });
    }, 3000);
  }, [sendSocketMessage]);

  const activeChannel = channels.find((c) => c.id === currentChannelId);
  const activeTeam = teams.find((t) => t.id === currentTeamId);
  const teamMembersList = teamMembers.filter((m) => m.team === currentTeamId);

  const currentUserIsAdmin = useMemo(() => {
    const membership = teamMembersList.find(
      (m) => Number(m.user) === Number(profile?.id)
    );
    if (membership?.role === "ADMIN") return true;
    return Number(activeTeam?.created_by) === Number(profile?.id);
  }, [teamMembersList, profile, activeTeam]);

  const handleLeaveTeam = useCallback(async (userId) => {
    if (!currentTeamId) return;
    await leaveTeam(currentTeamId, userId);
    navigate("/teams");
  }, [currentTeamId, leaveTeam, navigate]);

  const handleRemoveMember = useCallback(async (userId) => {
    if (!currentTeamId) return;
    await removeTeamMember(currentTeamId, userId);
  }, [currentTeamId, removeTeamMember]);

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
    // Generate a stable client-side identifier for this message.
    // This UUID is sent to the backend and echoed back in both the HTTP
    // response and the WS broadcast. That lets us reconcile the optimistic
    // placeholder with the real message regardless of which arrives first,
    // eliminating the duplicate-message race condition (C-01).
    const clientUuid = crypto.randomUUID();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      client_uuid: clientUuid,
      content: text || (file ? `📎 ${file.name}` : ""),
      channel: currentChannelId,
      sender: profile?.id,
      created_at: new Date().toISOString(),
      is_pinned: false,
      isOptimistic: true,
    };

    setChannelMessages((prev) => [...prev, optimisticMsg]);

    try {
      // Pass clientUuid so the backend stores and echoes it.
      const msg = await postMessage(currentChannelId, text, clientUuid);

      setChannelMessages((prev) => {
        const arr = [...prev];
        // Prefer uuid match; fall back to tempId in case WS already replaced it.
        const idx = arr.findIndex(
          (m) => m.client_uuid === clientUuid || m.id === tempId
        );
        if (idx >= 0) arr[idx] = msg;
        // If neither is found the WS handler already reconciled — no duplicate append.
        return arr;
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
      logger.error(extractErrorMessage(err));
      setChannelMessages((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex(
          (m) => m.client_uuid === clientUuid || m.id === tempId
        );
        if (idx >= 0) arr[idx] = { ...arr[idx], isError: true };
        return arr;
      });
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId, reactionType) => {
    setReactingId(messageId);
    try {
      await addReaction(messageId, reactionType);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    } finally {
      setReactingId(null);
    }
  };

  const handlePin = async (messageId) => {
    try {
      await pinMessage(messageId);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      await editMessage(messageId, newContent);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    }
  };

  const handleClearChat = async () => {
    if (!currentChannelId) return;
    try {
      await clearChannelChat(currentChannelId);
      setChannelMessages([]);
      setChannelAttachments([]);
      setChannelReactionsLocal([]);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    }
  };

  const handleDMSelect = async (userId) => {
    try {
      const dmChannel = await createDirectMessageChannel(userId);
      navigate(`/chat/dm/${dmChannel.id}`);
    } catch (err) {
      logger.error(extractErrorMessage(err));
    }
  };

  // ---------- INSTANT CALL (Teams style) ----------
  const handleVideoCall = async () => {
    if (!activeChannel) return;
    try {
      const channelLabel = getChannelDisplayName(activeChannel, profile?.id, usersMap);
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      const res = await workspaceApi.createMeeting({
        title: `Call in ${channelLabel}`,
        start_time: startTime,
        end_time: endTime,
        channel: activeChannel.id,
      });
      navigate(`/meetings/${res.data.id}/room`);
    } catch (err) {
      logger.error("Failed to start video call:", extractErrorMessage(err));
    }
  };

  const handleAudioCall = async () => {
    if (!activeChannel) return;
    try {
      const channelLabel = getChannelDisplayName(activeChannel, profile?.id, usersMap);
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await workspaceApi.createMeeting({
        title: `Audio call in ${channelLabel}`,
        start_time: startTime,
        end_time: endTime,
        channel: activeChannel.id,
      });
      // Navigate to room with audio-only flag via state
      navigate(`/meetings/${res.data.id}/room`, { state: { audioOnly: true } });
    } catch (err) {
      logger.error("Failed to start audio call:", extractErrorMessage(err));
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
            loadingOlder={loadingOlderMessages}
            hasOlder={Boolean(olderMessagesUrl)}
            onLoadOlder={handleLoadOlderMessages}
            typingUsers={typingUsers}
            onReact={handleReact}
            reactingId={reactingId}
            onPin={handlePin}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onClearChat={handleClearChat}
            onToggleMembers={() => setShowMembers(!showMembers)}
            onDMSelect={handleDMSelect}
            onVideoCall={handleVideoCall}
            onAudioCall={handleAudioCall}
          />
          <MessageInput
            channelName={getChannelDisplayName(activeChannel, profile?.id, usersMap)}
            onSend={handleSend}
            onTyping={handleTyping}
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
            onLeave={handleLeaveTeam}
            onRemove={currentUserIsAdmin ? handleRemoveMember : undefined}
            isAdmin={currentUserIsAdmin}
          />
        )}
      </div>
    </AppLayout>
  );
}
