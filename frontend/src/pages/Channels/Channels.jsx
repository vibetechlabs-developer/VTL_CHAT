import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Hash, Lock, Plus, Trash2 } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { extractErrorMessage } from "../../utils/helpers";import "./Channels.scss";

export default function Channels() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    channels,
    teams,
    teamMembers,
    unreadNotificationCount,
    createChannel,
    deleteChannel,
  } = useWorkspace();
  const confirm = useConfirm();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", team: "", channel_type: "PUBLIC" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const memberCounts = useMemo(() => {
    const counts = {};
    teamMembers.forEach((m) => {
      counts[m.team] = (counts[m.team] || 0) + 1;
    });
    return counts;
  }, [teamMembers]);

  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (!teams.length) {
        setFormError("Create a team first from the Teams page.");
        return;
      }
      await createChannel({
        name: form.name,
        description: form.description,
        team: Number(form.team || teams[0].id),
        channel_type: form.channel_type,
      });
      setShowModal(false);
      setForm({ name: "", description: "", team: "", channel_type: "PUBLIC" });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, ch) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete Channel",
      message: `Delete #${ch.name}? This cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
    });
    if (!ok) return;
    try {
      await deleteChannel(ch.id);
      toast.success("Channel deleted");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <AppLayout
      title="Channels"
      subtitle="Browse and manage workspace channels"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search channels..."
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="channels-page__toolbar">
        <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Create Channel
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Hash size={28} />}
          title="No channels yet"
          description="Create a channel to start conversations with your team."
          action={
            <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create Channel
            </button>
          }
        />
      ) : (
        <GlassCard padding={false} className="channels-page__list">
          {filtered.map((ch) => {
            const team = teams.find((t) => t.id === ch.team);
            const url = `/teams/${team?.id || ''}/channels/${ch.id}`;
            return (
              <Link key={ch.id} to={url} className="channel-row-link">
                <div className="channel-row">
                  <div className="channel-row__icon">
                    {ch.channel_type === "PRIVATE" ? <Lock size={18} /> : <Hash size={18} />}
                  </div>
                  <div className="channel-row__info">
                    <div className="channel-row__name">{ch.name}</div>
                    <p>{ch.description || team?.name || "No description"}</p>
                  </div>
                  <span className="channel-row__members">
                    {memberCounts[ch.team] || 0} members
                  </span>
                  <span className="channel-row__type">{ch.channel_type}</span>
                  <button
                    type="button"
                    className="channel-row__delete"
                    title="Delete channel"
                    onClick={(e) => handleDelete(e, ch)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Link>
            );
          })}
        </GlassCard>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Channel">
        <form className="vtl-modal__form" onSubmit={handleCreate}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Channel name
            <input
              required
              minLength={3}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="general"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Team
            <select
              value={form.team || teams[0]?.id || ""}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
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
              value={form.channel_type}
              onChange={(e) => setForm({ ...form, channel_type: e.target.value })}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
