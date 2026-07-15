import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, AtSign, Shield, Edit3, Camera, Loader2 } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import * as workspaceApi from "../../services/workspaceApi";
import { extractErrorMessage, getAvatarColor, getInitials } from "../../utils/helpers";
import logger from "../../utils/logger";
import "./Profile.scss";

export default function Profile() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    channels,
    meetings,
    unreadNotificationCount,
    updateProfile,
    updateProfileAvatar,
  } = useWorkspace();

  const [stats, setStats] = useState(null);

  useEffect(() => {
    workspaceApi.getProfileStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [profile?.id]);

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  const myMessages = stats?.messages_sent ?? 0;
  const myTeams = stats?.teams_count ?? 0;
  const myChannels = stats?.channels_count ?? channels.length;
  const myMeetings = stats?.meetings_hosted ?? meetings.length;

  const openEdit = () => {
    setForm({
      username: profile?.username || "",
      email: profile?.email || "",
      password: "",
    });
    setFormError("");
    setShowEdit(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const payload = { username: form.username, email: form.email };
      if (form.password) payload.password = form.password;
      await updateProfile(payload);
      setShowEdit(false);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await updateProfileAvatar(file);
    } catch (err) {
      logger.error("Avatar upload failed:", extractErrorMessage(err));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const avatarUrl = profile?.avatar_url;
  const avatarColor = getAvatarColor(profile?.username || "");

  return (
    <AppLayout
      title="Profile"
      subtitle="Manage your personal information"
      showSearch={false}
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="profile-page">
        <GlassCard className="profile-hero">
          <div className="profile-hero__avatar-wrapper">
            <div
              className="profile-hero__avatar"
              style={!avatarUrl ? { background: avatarColor } : {}}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile?.username} className="profile-hero__avatar-img" />
              ) : (
                initials
              )}
              {avatarUploading && (
                <div className="profile-hero__avatar-overlay">
                  <Loader2 size={22} className="spin" />
                </div>
              )}
            </div>
            <button
              className="profile-hero__avatar-btn"
              title="Change avatar"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
            >
              <Camera size={16} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>

          <div className="profile-hero__info">
            <h2>{profile?.username || "User"}</h2>
            <p>{profile?.email || "—"}</p>
            <span className="profile-hero__badge">VTL Member</span>
          </div>
          <button className="vtl-btn vtl-btn--ghost" onClick={openEdit}>
            <Edit3 size={16} /> Edit Profile
          </button>
        </GlassCard>

        <div className="profile-page__grid">
          <GlassCard className="profile-detail">
            <h4>Account Details</h4>
            <div className="profile-detail__row">
              <Mail size={16} />
              <div>
                <span>Email</span>
                <p>{profile?.email || "—"}</p>
              </div>
            </div>
            <div className="profile-detail__row">
              <Shield size={16} />
              <div>
                <span>User ID</span>
                <p>#{profile?.id || "—"}</p>
              </div>
            </div>
            <div className="profile-detail__row">
                <AtSign size={16} />
              <div>
                <span>Username</span>
                <p>{profile?.username || "—"}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="profile-stats">
            <h4>Activity Summary</h4>
            <div className="profile-stats__grid">
              <div><strong>{myMessages}</strong><span>Messages sent</span></div>
              <div><strong>{myTeams}</strong><span>Teams joined</span></div>
              <div><strong>{myChannels}</strong><span>Channels</span></div>
              <div><strong>{myMeetings}</strong><span>Meetings hosted</span></div>
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Profile">
        <form className="vtl-modal__form" onSubmit={handleSave}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Username
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            New password (optional)
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Leave blank to keep current"
            />
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowEdit(false)}>Cancel</button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
