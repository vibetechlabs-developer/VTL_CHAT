import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users,
  FolderKanban,
  MoreHorizontal,
  UserPlus,
  Loader2,
  Shield,
} from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import Modal from "../../components/vtl/Modal";
import SearchableMultiSelect from "../../components/vtl/SearchableMultiSelect";
import { useWorkspace } from "../../context/WorkspaceContext";
import * as workspaceApi from "../../services/workspaceApi";
import {
  extractErrorMessage,
  getTeamGradient,
  getInitials,
  getAvatarColor,
} from "../../utils/helpers";
import "./Teams.scss";

export default function Teams() {
  const {
    profile,
    loading,
    users,
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
    addTeamMember,
  } = useWorkspace();

  const [selectedTeam, setSelectedTeam] = useState(null);
  const [inviteTeamMembers, setInviteTeamMembers] = useState([]);
  const [inviteMembersLoading, setInviteMembersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteError, setInviteError] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", team_type: "PUBLIC", organizationName: "My Workspace" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);


  const filtered = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [teams, search]
  );

  const availableUsers = useMemo(() => {
    if (!selectedTeam) return [];
    const memberIds = new Set(
      inviteTeamMembers.map((m) => Number(m.user))
    );
    return users.filter(
      (u) => Number(u.id) !== Number(profile?.id) && !memberIds.has(Number(u.id))
    );
  }, [users, inviteTeamMembers, selectedTeam, profile]);

  const currentTeamMembers = useMemo(() => {
    return inviteTeamMembers
      .map((m) => {
        if (Number(m.user) === Number(profile?.id)) return profile;
        return users.find((u) => Number(u.id) === Number(m.user));
      })
      .filter(Boolean);
  }, [inviteTeamMembers, users, profile]);

  const inviteUserOptions = useMemo(
    () =>
      availableUsers.map((u) => ({
        id: u.id,
        label: u.username,
        sublabel: u.email,
      })),
    [availableUsers]
  );

  useEffect(() => {
    const validIds = new Set(availableUsers.map((u) => Number(u.id)));
    setSelectedUserIds((prev) => prev.filter((id) => validIds.has(Number(id))));
  }, [availableUsers]);

  const loadInviteMembers = async (teamId) => {
    setInviteMembersLoading(true);
    try {
      const res = await workspaceApi.getTeamMembers(teamId);
      setInviteTeamMembers(res.data);
    } catch (err) {
      setInviteError(extractErrorMessage(err));
      setInviteTeamMembers([]);
    } finally {
      setInviteMembersLoading(false);
    }
  };

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

  const openInvite = (team) => {
    setSelectedTeam(team);
    setSelectedUserIds([]);
    setInviteRole("MEMBER");
    setInviteError("");
    setInviteTeamMembers([]);
    setShowInviteModal(true);
    loadInviteMembers(team.id);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      setInviteError("Please select at least one user to invite.");
      return;
    }
    setInviteError("");
    setInviteSubmitting(true);
    try {
      const results = await Promise.allSettled(
        selectedUserIds.map((userId) =>
          addTeamMember({
            team: selectedTeam.id,
            user: userId,
            role: inviteRole,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      await loadInviteMembers(selectedTeam.id);

      if (failed.length === results.length) {
        setInviteError(extractErrorMessage(failed[0].reason));
      } else if (failed.length > 0) {
        setInviteError(
          `${results.length - failed.length} added, ${failed.length} failed.`
        );
      } else {
        setShowInviteModal(false);
      }
    } catch (err) {
      setInviteError(extractErrorMessage(err));
    } finally {
      setInviteSubmitting(false);
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
                <button className="vtl-btn vtl-btn--ghost vtl-btn--sm" onClick={() => openInvite(team)}><UserPlus size={14} /> Invite</button>
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

      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={`Invite to ${selectedTeam?.name || "Team"}`}
        wide
        scrollable
      >
        <form className="vtl-modal__form teams-invite" onSubmit={handleInvite}>
          <div className="teams-invite__scroll">
            {selectedTeam && (
              <div className="teams-invite__team">
                <div
                  className="teams-invite__team-icon"
                  style={{ background: getTeamGradient(selectedTeam.name) }}
                >
                  {selectedTeam.name.charAt(0).toUpperCase()}
                </div>
                <div className="teams-invite__team-info">
                  <strong>{selectedTeam.name}</strong>
                  <span>
                    {inviteMembersLoading
                      ? "Loading members..."
                      : `${inviteTeamMembers.length} current member${inviteTeamMembers.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            )}

            {!inviteMembersLoading && currentTeamMembers.length > 0 && (
              <div className="teams-invite__existing">
                <span className="teams-invite__label">Already in team</span>
                <div className="teams-invite__existing-list">
                  {currentTeamMembers.map((u) => (
                    <span key={u.id} className="teams-invite__existing-chip">
                      <span
                        className="teams-invite__existing-avatar"
                        style={{ background: getAvatarColor(u.username) }}
                      >
                        {getInitials(u.username)}
                      </span>
                      {u.username}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {inviteError && <div className="vtl-modal__error">{inviteError}</div>}

            {inviteMembersLoading ? (
              <div className="teams-invite__loading">
                <Loader2 size={24} className="spin" />
                <span>Loading available members...</span>
              </div>
            ) : availableUsers.length === 0 ? (
              <EmptyState
                icon={<Users size={24} />}
                title="No users to invite"
                description="Everyone is already on this team, or no other accounts exist yet."
              />
            ) : (
              <>
                <div className="teams-invite__section">
                  <span className="teams-invite__label">Add members</span>
                  <SearchableMultiSelect
                    options={inviteUserOptions}
                    value={selectedUserIds}
                    onChange={setSelectedUserIds}
                    placeholder="Search by name or email..."
                    emptyMessage="No users match your search"
                  />
                </div>

                <div className="teams-invite__section">
                  <span className="teams-invite__label">Role for all selected</span>
                  <div className="teams-invite__roles">
                    {[
                      { value: "MEMBER", label: "Member", desc: "Can chat and view channels" },
                      { value: "ADMIN", label: "Admin", desc: "Can manage team and invites" },
                    ].map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        className={`teams-invite__role ${
                          inviteRole === role.value ? "teams-invite__role--active" : ""
                        }`}
                        onClick={() => setInviteRole(role.value)}
                      >
                        <Shield size={16} />
                        <div>
                          <strong>{role.label}</strong>
                          <span>{role.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {!inviteMembersLoading && availableUsers.length > 0 && (
            <div className="teams-invite__footer vtl-modal__actions">
              <button
                type="button"
                className="vtl-btn vtl-btn--ghost"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="vtl-btn vtl-btn--primary"
                disabled={inviteSubmitting || selectedUserIds.length === 0}
              >
                {inviteSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {selectedUserIds.length > 1
                      ? `Add ${selectedUserIds.length} Members`
                      : selectedUserIds.length === 1
                        ? "Add 1 Member"
                        : "Add Members"}
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </Modal>    </AppLayout>
  );
}

