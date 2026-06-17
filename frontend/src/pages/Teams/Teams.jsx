import { useMemo, useState } from "react";
import { Plus, Users, FolderKanban, MoreHorizontal, UserPlus } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import Modal from "../../components/vtl/Modal";
import { useWorkspace } from "../../context/WorkspaceContext";
import { extractErrorMessage, getTeamGradient } from "../../utils/helpers";
import "./Teams.scss";

export default function Teams() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    teams,
    organizations,
    unreadNotificationCount,
    createOrganization,
    createTeam,
    getTeamMemberCount,
    getChannelCountForTeam,
  } = useWorkspace();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", team_type: "PUBLIC", organizationName: "My Workspace" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [teams, search]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      let orgId = organizations[0]?.id;
      if (!orgId) {
        const org = await createOrganization({
          name: form.organizationName || "My Workspace",
          description: "VTL Chat workspace",
        });
        orgId = org.id;
      }

      await createTeam({
        name: form.name,
        description: form.description,
        organization: orgId,
        team_type: form.team_type,
      });

      setShowModal(false);
      setForm({ name: "", description: "", team_type: "PUBLIC", organizationName: "My Workspace" });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Teams"
      subtitle="Organize people and projects"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search teams..."
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="teams-page__toolbar">
        <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Create Team
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No teams yet"
          description="Create your first team to start collaborating with your workspace."
          action={
            <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create Team
            </button>
          }
        />
      ) : (
        <div className="teams-page__grid">
          {filtered.map((team) => (
            <GlassCard key={team.id} hover className="team-card">
              <div className="team-card__head">
                <div className="team-card__icon" style={{ background: getTeamGradient(team.name) }}>
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="team-card__meta">
                  <h3>{team.name}</h3>
                  <p>{team.description || "No description"}</p>
                </div>
                <button className="team-card__menu"><MoreHorizontal size={16} /></button>
              </div>
              <div className="team-card__stats">
                <span><Users size={14} /> {getTeamMemberCount(team.id)} members</span>
                <span><FolderKanban size={14} /> {getChannelCountForTeam(team.id)} channels</span>
              </div>
              <div className="team-card__actions">
                <button className="vtl-btn vtl-btn--ghost vtl-btn--sm"><UserPlus size={14} /> Invite</button>
                <button className="vtl-btn vtl-btn--ghost vtl-btn--sm">{team.team_type}</button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Team">
        <form className="vtl-modal__form" onSubmit={handleCreate}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          {organizations.length === 0 && (
            <label>
              Workspace name
              <input
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                placeholder="My Workspace"
                required
              />
            </label>
          )}
          <label>
            Team name
            <input
              required
              minLength={3}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Engineering"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this team work on?"
            />
          </label>
          <label>
            Visibility
            <select
              value={form.team_type}
              onChange={(e) => setForm({ ...form, team_type: e.target.value })}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
