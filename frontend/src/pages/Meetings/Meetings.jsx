import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Video, Calendar, Clock, Loader2, Trash2 } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import {
  extractErrorMessage,
  formatMeetingDate,
  formatMeetingTime,
} from "../../utils/helpers";
import "./Meetings.scss";

export default function Meetings() {
  const navigate = useNavigate();
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    meetings,
    channels,
    usersMap,
    unreadNotificationCount,
    createMeeting,
    deleteMeeting,
  } = useWorkspace();
  const confirm = useConfirm();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    channel: "",
    start_time: "",
    end_time: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(
    () =>
      meetings
        .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [meetings, search]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    
    const now = new Date();
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);

    if (start < now) {
      setFormError("Start time cannot be in the past.");
      return;
    }

    if (end <= start) {
      setFormError("End time must be after the start time.");
      return;
    }

    setSubmitting(true);
    try {
      if (!channels.length) {
        setFormError("Create a channel first before scheduling a meeting.");
        return;
      }
      await createMeeting({
        title: form.title,
        description: form.description,
        channel: Number(form.channel || channels[0].id),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setShowModal(false);
      setForm({ title: "", description: "", channel: "", start_time: "", end_time: "" });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = (meetingId) => {
    navigate(`/meetings/${meetingId}/room`);
  };

  // Determines if a meeting is upcoming (starts in the future)
  const isUpcoming = (startTime) => new Date(startTime) > new Date();

  // Determines if a meeting is currently ongoing (started but not ended)
  const isOngoing = (startTime, endTime) => {
    const now = new Date();
    return new Date(startTime) <= now && new Date(endTime) >= now;
  };

  // Determines if a meeting starts within 5 minutes
  const startsSoon = (startTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start - now;
    return diff > 0 && diff <= 5 * 60 * 1000;
  };

  const handleDeleteMeeting = async (meeting) => {
    const ok = await confirm({
      title: "Cancel Meeting",
      message: `Remove "${meeting.title}" from the schedule?`,
      confirmText: "Delete",
      type: "danger",
    });
    if (!ok) return;
    try {
      await deleteMeeting(meeting.id);
      toast.success("Meeting deleted");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <AppLayout
      title="Meetings"
      subtitle="Schedule and join video calls"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search meetings..."
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="meetings-page__toolbar">
        <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Schedule Meeting
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Video size={28} />}
          title="No meetings scheduled"
          description="Schedule your first meeting to collaborate with your team."
          action={
            <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Schedule Meeting
            </button>
          }
        />
      ) : (
        <div className="meetings-page__grid">
          {filtered.map((m) => (
            <GlassCard key={m.id} hover className="meeting-card">
              <div className="meeting-card__status">
                {
  new Date(m.start_time) > new Date() ? "upcoming" :
  new Date(m.end_time) < new Date() ? "past" : "ongoing"
}
              </div>
              <h3>{m.title}</h3>
              <div className="meeting-card__meta">
                <span><Calendar size={14} /> {formatMeetingDate(m.start_time)}</span>
                <span><Clock size={14} /> {formatMeetingTime(m.start_time, m.end_time)}</span>
              </div>
              <p className="meeting-card__host">
                Hosted by {usersMap[m.host]?.username || "Unknown"}
              </p>
              {m.description && <p className="meeting-card__desc">{m.description}</p>}
              <div className="meeting-card__footer">
              {(isOngoing(m.start_time, m.end_time) || startsSoon(m.start_time)) && (
                <button
                  className="vtl-btn vtl-btn--primary vtl-btn--sm"
                  onClick={() => handleJoin(m.id)}
                  disabled={joiningId === m.id}
                >
                  {joiningId === m.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Video size={14} />
                  )}
                  {isOngoing(m.start_time, m.end_time) ? "Join" : "Join Soon"}
                </button>
              )}
              <button
                type="button"
                className="vtl-btn vtl-btn--ghost vtl-btn--sm"
                onClick={() => handleDeleteMeeting(m)}
                title="Delete meeting"
              >
                <Trash2 size={14} />
              </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Schedule Meeting">
        <form className="vtl-modal__form" onSubmit={handleCreate}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Product sync"
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
            Channel
            <select
              value={form.channel || channels[0]?.id || ""}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              required
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input
              type="datetime-local"
              required
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
          </label>
          <label>
            End time
            <input
              type="datetime-local"
              required
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Scheduling..." : "Schedule"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
