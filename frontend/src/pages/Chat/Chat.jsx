import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/vtl/AppLayout";
import ChannelSidebar from "../../components/chat/ChannelSidebar";
import MessageArea from "../../components/chat/MessageArea";
import MessageInput from "../../components/chat/MessageInput";
import MemberPanel from "../../components/chat/MemberPanel";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage } from "../../utils/helpers";
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
    createChannel,
    addReaction,
    uploadMessageAttachment,
  } = useWorkspace();

  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelAttachments, setChannelAttachments] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", description: "", team: "", channel_type: "PUBLIC" });
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    if (teams.length && !activeTeamId) setActiveTeamId(teams[0].id);
  }, [teams, activeTeamId]);

  useEffect(() => {
    if (!activeTeamId) return;
    const teamChannels = channels.filter((c) => c.team === activeTeamId);
    if (teamChannels.length && !activeChannelId) {
      setActiveChannelId(teamChannels[0].id);
    }
  }, [channels, activeTeamId, activeChannelId]);

  const loadMessages = useCallback(async () => {
    if (!activeChannelId) return;
    setMessagesLoading(true);
    try {
      const [messagesRes, attachmentsRes] = await Promise.all([
        fetchChannelMessages(activeChannelId),
        workspaceApi.getAttachments(activeChannelId).then((r) => r.data).catch(() => []),
      ]);
      setChannelMessages(messagesRes);
      setChannelAttachments(attachmentsRes);
    } catch (err) {
      console.error(extractErrorMessage(err));
    } finally {
      setMessagesLoading(false);
    }
  }, [activeChannelId, fetchChannelMessages]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamMembersList = teamMembers.filter((m) => m.team === activeTeamId);

  const channelReactions = useMemo(
    () => reactions.filter((r) => channelMessages.some((m) => m.id === r.message)),
    [reactions, channelMessages]
  );

  const handleSend = async (content, file) => {
    if (!activeChannelId) return;
    setSending(true);
    try {
      const text = content.trim() || (file ? `Shared ${file.name}` : "");
      const msg = await postMessage(activeChannelId, text);
      if (file) {
        await uploadMessageAttachment(msg.id, file);
      }
      await loadMessages();
    } catch (err) {
      console.error(extractErrorMessage(err));
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
      let teamId = channelForm.team || activeTeamId;
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
          activeTeamId={activeTeamId}
          activeChannelId={activeChannelId}
          onTeamSelect={(id) => {
            setActiveTeamId(id);
            const first = channels.find((c) => c.team === id);
            setActiveChannelId(first?.id || null);
          }}
          onChannelSelect={setActiveChannelId}
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
          />
          <MessageInput
            channelName={activeChannel?.name || "channel"}
            onSend={handleSend}
            disabled={!activeChannelId}
            sending={sending}
          />
        </div>

        <MemberPanel
          members={teamMembersList}
          usersMap={usersMap}
          profile={profile}
          teamName={activeTeam?.name}
        />
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
              value={channelForm.team || activeTeamId || ""}
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
