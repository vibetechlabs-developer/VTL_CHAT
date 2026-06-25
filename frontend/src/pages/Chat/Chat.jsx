import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/vtl/AppLayout";
import ChannelSidebar from "../../components/chat/ChannelSidebar";
import MessageArea from "../../components/chat/MessageArea";
import MessageInput from "../../components/chat/MessageInput";
import MemberPanel from "../../components/chat/MemberPanel";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useChatSocket } from "../../hooks/useChatSocket";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage, getChannelDisplayName } from "../../utils/helpers";
import "./Chat.scss";

export default function Chat() {
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
    pinMessage,
    createChannel,
    createDirectMessageChannel,
    addReaction,
    uploadMessageAttachment,
  } = useWorkspace();

  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelAttachments, setChannelAttachments] = useState([]);
  const [channelReactionsLocal, setChannelReactionsLocal] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [channelForm, setChannelForm] = useState({ name: "", description: "", team: "", channel_type: "PUBLIC" });
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const currentTeamId = activeTeamId || (teams.length ? teams[0].id : null);
  const teamChannels = useMemo(() => {
    return channels.filter((c) => c.team === currentTeamId);
  }, [channels, currentTeamId]);
  const currentChannelId = activeChannelId || (teamChannels.length ? teamChannels[0].id : null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!currentChannelId) return;
      await Promise.resolve(); // Defer execution to prevent synchronous setState inside effect
      if (!active) return;
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

  useChatSocket(currentChannelId, handleSocketEvent);

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
    
    const text = content.trim() || (file ? `Shared ${file.name}` : "");
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: text,
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
        await uploadMessageAttachment(msg.id, file);
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

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitting(true);
    try {
      let teamId = channelForm.team || currentTeamId;
      if (!teamId && teams[0]) teamId = teams[0].id;

      if (!teamId) {
        setFormError("Create a team first from the Teams page.");
        return;
      }

      await createChannel({
        name: channelForm.name,
        description: channelForm.description,
        team: Number(teamId),
        channel_type: channelForm.channel_type,
      });
      setShowCreateChannel(false);
      setChannelForm({ name: "", description: "", team: "", channel_type: "PUBLIC" });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDMSelect = async (userId) => {
    try {
      const dmChannel = await createDirectMessageChannel(userId);
      setActiveChannelId(dmChannel.id);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  const handlePin = async (messageId) => {
    try {
      await pinMessage(messageId);
    } catch (err) {
      console.error(extractErrorMessage(err));
    }
  };

  return (
    <AppLayout
      title="Chat"
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
        <ChannelSidebar
          teams={teams}
          channels={channels}
          users={users}
          activeTeamId={currentTeamId}
          activeChannelId={currentChannelId}
          onTeamSelect={(id) => {
            setActiveTeamId(id);
            const first = channels.find((c) => c.team === id);
            setActiveChannelId(first?.id || null);
          }}
          onChannelSelect={setActiveChannelId}
          onDMSelect={handleDMSelect}
          profile={profile}
          initials={initials}
          loading={loading}
          onCreateChannel={() => setShowCreateChannel(true)}
        />

        <div className="chat-workspace__main">
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
            onToggleMembers={() => setShowMembers(!showMembers)}
          />
          <MessageInput
            channelName={getChannelDisplayName(activeChannel, profile?.id, usersMap)}
            onSend={handleSend}
            disabled={!currentChannelId}
            sending={sending}
          />
        </div>

        {showMembers && (
          <MemberPanel
            members={teamMembersList}
            usersMap={usersMap}
            profile={profile}
            teamName={activeTeam?.name}
            onDMSelect={handleDMSelect}
          />
        )}
      </div>

      <Modal open={showCreateChannel} onClose={() => setShowCreateChannel(false)} title="Create Channel">
        <form className="vtl-modal__form" onSubmit={handleCreateChannel}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Channel name
            <input
              required
              minLength={3}
              value={channelForm.name}
              onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
              placeholder="general"
            />
          </label>
          <label>
            Description
            <textarea
              value={channelForm.description}
              onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
              placeholder="What is this channel about?"
            />
          </label>
          <label>
            Team
            <select
              value={channelForm.team || currentTeamId || ""}
              onChange={(e) => setChannelForm({ ...channelForm, team: e.target.value })}
              required
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              value={channelForm.channel_type}
              onChange={(e) => setChannelForm({ ...channelForm, channel_type: e.target.value })}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowCreateChannel(false)}>
              Cancel
            </button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={formSubmitting}>
              {formSubmitting ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
