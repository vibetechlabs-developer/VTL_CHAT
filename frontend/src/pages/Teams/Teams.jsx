import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  Users,
  FolderKanban,
  MoreHorizontal,
  UserPlus,
  Loader2,
  Shield,
  Trash2,
  LogOut,
  UserMinus,
  X,
} from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import EmptyState from "../../components/vtl/EmptyState";
import Modal from "../../components/vtl/Modal";
import SearchableMultiSelect from "../../components/vtl/SearchableMultiSelect";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
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
    teamMembers,
    organizations,
    unreadNotificationCount,
    createOrganization,
    createTeam,
    getTeamMemberCount,
    getChannelCountForTeam,
    addTeamMember,
    joinTeam,
    leaveTeam,
    removeTeamMember,
    deleteTeam,
  } = useWorkspace();
  const confirm = useConfirm();
  const toast = useToast();

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
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showGroupInviteModal, setShowGroupInviteModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [groupFormError, setGroupFormError] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupInviteUserIds, setGroupInviteUserIds] = useState([]);
  const [groupInviteRole, setGroupInviteRole] = useState("MEMBER");
  const [groupInviteSubmitting, setGroupInviteSubmitting] = useState(false);
  const [groupInviteError, setGroupInviteError] = useState("");

  const getMembership = (teamId, userId = profile?.id) =>
    teamMembers.find(
      (m) => Number(m.team) === Number(teamId) && Number(m.user) === Number(userId)
    );

  const isTeamMember = (teamId) => Boolean(getMembership(teamId));

  const isTeamAdmin = (teamId) => {
    const membership = getMembership(teamId);
    if (membership?.role === "ADMIN") return true;
    const team = teams.find((t) => Number(t.id) === Number(teamId));
    return Number(team?.created_by) === Number(profile?.id);
  };

  const isGroupAdmin = (groupId) => {
    const membership = groupMembers.find(
      (m) => Number(m.group) === Number(groupId) && Number(m.user) === Number(profile?.id)
    );
    if (membership?.role === "ADMIN") return true;
    const group = groups.find((g) => Number(g.id) === Number(groupId));
    return Number(group?.created_by) === Number(profile?.id);
  };

  const isGroupMember = (groupId) => {
    return groupMembers.some(
      (m) => Number(m.group) === Number(groupId) && Number(m.user) === Number(profile?.id)
    );
  };

  const canJoinTeam = (team) =>
    !isTeamMember(team.id) && team.team_type === "PUBLIC";


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }, [teams, search]);

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

  const filteredSelectedUserIds = useMemo(() => {
    const validIds = new Set(availableUsers.map((u) => Number(u.id)));
    return selectedUserIds.filter((id) => validIds.has(Number(id)));
  }, [selectedUserIds, availableUsers]);

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
    if (!isTeamAdmin(team.id)) {
      toast.error("Only team admins can invite members.");
      return;
    }
    setSelectedTeam(team);
    setSelectedUserIds([]);
    setInviteRole("MEMBER");
    setInviteError("");
    setInviteTeamMembers([]);
    setShowInviteModal(true);
    loadInviteMembers(team.id);
  };

  const openTeamDetail = async (team) => {
    setSelectedTeam(team);
    const res = await workspaceApi.getGroups(team.id);
    setGroups(res.data);
    for (const group of res.data) {
      await loadGroupMembers(group.id);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (filteredSelectedUserIds.length === 0) {
      setInviteError("Please select at least one user to invite.");
      return;
    }
    setInviteError("");
    setInviteSubmitting(true);
    try {
      const results = await Promise.allSettled(
        filteredSelectedUserIds.map((userId) =>
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

  const handleDeleteTeam = async (team) => {
    if (!isTeamAdmin(team.id)) {
      toast.error("Only team admins can delete this team.");
      return;
    }
    const ok = await confirm({
      title: "Delete Team",
      message: `Delete "${team.name}" permanently? All channels, messages, and member associations will be removed. This cannot be undone.`,
      confirmText: "Delete Team",
      type: "danger",
    });
    if (!ok) return;
    try {
      await deleteTeam(team.id);
      toast.success("Team deleted");
      if (selectedTeam && Number(selectedTeam.id) === Number(team.id)) {
        setSelectedTeam(null);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleJoinTeam = async (team) => {
    try {
      await joinTeam(team.id);
      toast.success(`Joined ${team.name}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleLeaveTeam = async (team) => {
    const ok = await confirm({
      title: "Leave Team",
      message: `Leave "${team.name}"? You will lose access to its channels and messages.`,
      confirmText: "Leave",
      type: "danger",
    });
    if (!ok) return;
    try {
      await leaveTeam(team.id, profile.id);
      toast.success(`Left ${team.name}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleRemoveMember = async (userId, username) => {
    const ok = await confirm({
      title: "Remove Member",
      message: `Remove ${username} from ${selectedTeam?.name}?`,
      confirmText: "Remove",
      type: "danger",
    });
    if (!ok) return;
    try {
      await removeTeamMember(selectedTeam.id, userId);
      await loadInviteMembers(selectedTeam.id);
      toast.success(`${username} removed from team`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const loadGroups = async (teamId) => {
    try {
      const res = await workspaceApi.getGroups(teamId);
      setGroups(res.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const loadGroupMembers = async (groupId) => {
    try {
      const res = await workspaceApi.getGroupMembers(groupId);
      setGroupMembers(res.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupFormError("");
    setGroupSubmitting(true);
    try {
      await workspaceApi.createGroup({
        ...groupForm,
        team: selectedTeam.id,
      });
      await loadGroups(selectedTeam.id);
      setShowGroupModal(false);
      setGroupForm({ name: "", description: "" });
      toast.success("Group created");
    } catch (err) {
      setGroupFormError(extractErrorMessage(err));
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    const ok = await confirm({
      title: "Delete Group",
      message: `Delete "${group.name}"? This cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
    });
    if (!ok) return;
    try {
      await workspaceApi.deleteGroup(group.id);
      await loadGroups(selectedTeam.id);
      toast.success("Group deleted");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      await workspaceApi.joinGroup(group.id);
      await loadGroups(selectedTeam.id);
      await loadGroupMembers(group.id);
      toast.success(`Joined ${group.name}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleLeaveGroup = async (group) => {
    const ok = await confirm({
      title: "Leave Group",
      message: `Leave "${group.name}"?`,
      confirmText: "Leave",
      type: "danger",
    });
    if (!ok) return;
    try {
      await workspaceApi.leaveGroup(group.id, profile.id);
      await loadGroups(selectedTeam.id);
      toast.success(`Left ${group.name}`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const openGroupInvite = async (group) => {
    await loadGroupMembers(group.id);
    if (!isGroupAdmin(group.id)) {
      toast.error("Only group admins can invite members.");
      return;
    }
    setSelectedGroup(group);
    setGroupInviteUserIds([]);
    setGroupInviteRole("MEMBER");
    setGroupInviteError("");
    setShowGroupInviteModal(true);
  };

  const handleGroupInvite = async (e) => {
    e.preventDefault();
    if (groupInviteUserIds.length === 0) {
      setGroupInviteError("Please select at least one user to invite.");
      return;
    }
    setGroupInviteError("");
    setGroupInviteSubmitting(true);
    try {
      const results = await Promise.allSettled(
        groupInviteUserIds.map((userId) =>
          workspaceApi.addGroupMember({
            group: selectedGroup.id,
            user: userId,
            role: groupInviteRole,
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      await loadGroupMembers(selectedGroup.id);

      if (failed.length === results.length) {
        setGroupInviteError(extractErrorMessage(failed[0].reason));
      } else if (failed.length > 0) {
        setGroupInviteError(
          `${results.length - failed.length} added, ${failed.length} failed.`
        );
      } else {
        setShowGroupInviteModal(false);
      }
    } catch (err) {
      setGroupInviteError(extractErrorMessage(err));
    } finally {
      setGroupInviteSubmitting(false);
    }
  };

  const handleRemoveGroupMember = async (userId, username) => {
    const ok = await confirm({
      title: "Remove Member",
      message: `Remove ${username} from ${selectedGroup?.name}?`,
      confirmText: "Remove",
      type: "danger",
    });
    if (!ok) return;
    try {
      await workspaceApi.removeGroupMember(selectedGroup.id, userId);
      await loadGroupMembers(selectedGroup.id);
      toast.success(`${username} removed from group`);
    } catch (err) {
      toast.error(extractErrorMessage(err));
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
      loading={false}
      error={null}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="teams-page__toolbar">
        <span className="teams-page__toolbar-title">
          {filtered.length > 0 ? `${filtered.length} team${filtered.length !== 1 ? 's' : ''}` : 'No teams'}
        </span>
        <button 
          className="vtl-btn vtl-btn--primary" 
          onClick={() => setShowModal(true)}
          id="create-team-btn"
        >
          <Plus size={16} /> Create Team
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={search.trim() ? "No matching teams" : "No teams yet"}
          description={
            search.trim()
              ? `Nothing matches "${search.trim()}". Try a different name.`
              : "Create your first team to start collaborating with your workspace."
          }
          action={
            !search.trim() ? (
              <button className="vtl-btn vtl-btn--primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Create Team
              </button>
            ) : null
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
                {canJoinTeam(team) && (
                  <button
                    type="button"
                    className="vtl-btn vtl-btn--primary vtl-btn--sm"
                    onClick={() => handleJoinTeam(team)}
                  >
                    <UserPlus size={14} /> Join
                  </button>
                )}
                {isTeamMember(team.id) && isTeamAdmin(team.id) && (
                  <button
                    type="button"
                    className="vtl-btn vtl-btn--ghost vtl-btn--sm"
                    onClick={() => openInvite(team)}
                  >
                    <UserPlus size={14} /> Invite
                  </button>
                )}
                {isTeamMember(team.id) && (
                  <button
                    type="button"
                    className="vtl-btn vtl-btn--ghost vtl-btn--sm"
                    onClick={() => openTeamDetail(team)}
                  >
                    <Users size={14} /> Groups
                  </button>
                )}
                {isTeamMember(team.id) && (
                  <button
                    type="button"
                    className="vtl-btn vtl-btn--ghost vtl-btn--sm team-card__leave"
                    onClick={() => handleLeaveTeam(team)}
                  >
                    <LogOut size={14} /> Leave
                  </button>
                )}
                <button type="button" className="vtl-btn vtl-btn--ghost vtl-btn--sm">
                  {team.team_type}
                </button>
                {isTeamAdmin(team.id) && (
                  <button
                    type="button"
                    className="vtl-btn vtl-btn--ghost vtl-btn--sm team-card__delete"
                    onClick={() => handleDeleteTeam(team)}
                    title="Delete team"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {selectedTeam && Number(selectedTeam.id) === Number(team.id) && groups.length > 0 && (
                <div className="team-card__groups">
                  <span className="team-card__groups-label">Groups</span>
                  <div className="team-card__groups-list">
                    {groups.map((group) => (
                      <div key={group.id} className="team-card__group-item">
                        <div className="team-card__group-info">
                          <span>{group.name}</span>
                          <span className="team-card__group-members">
                            {groupMembers.filter(m => Number(m.group) === Number(group.id)).length} members
                          </span>
                        </div>
                        <div className="team-card__group-actions">
                          {isGroupAdmin(group.id) && (
                            <button
                              type="button"
                              className="vtl-btn vtl-btn--ghost vtl-btn--xs"
                              onClick={() => openGroupInvite(group)}
                              title="Manage members"
                            >
                              <Users size={12} />
                            </button>
                          )}
                          {isGroupMember(group.id) && (
                            <button
                              type="button"
                              className="vtl-btn vtl-btn--ghost vtl-btn--xs"
                              onClick={() => handleLeaveGroup(group)}
                              title="Leave group"
                            >
                              <LogOut size={12} />
                            </button>
                          )}
                          {!isGroupMember(group.id) && (
                            <button
                              type="button"
                              className="vtl-btn vtl-btn--primary vtl-btn--xs"
                              onClick={() => handleJoinGroup(group)}
                              title="Join group"
                            >
                              <UserPlus size={12} />
                            </button>
                          )}
                          {isGroupAdmin(group.id) && (
                            <button
                              type="button"
                              className="vtl-btn vtl-btn--ghost vtl-btn--xs team-card__group-delete"
                              onClick={() => handleDeleteGroup(group)}
                              title="Delete group"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isTeamMember(team.id) && (
                    <button
                      type="button"
                      className="vtl-btn vtl-btn--ghost vtl-btn--xs team-card__add-group"
                      onClick={() => setShowGroupModal(true)}
                    >
                      <Plus size={12} /> Create Group
                    </button>
                  )}
                </div>
              )}
            
              
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
                  {currentTeamMembers.map((u) => {
                    const membership = inviteTeamMembers.find(
                      (m) => Number(m.user) === Number(u.id)
                    );
                    const canRemove =
                      selectedTeam &&
                      isTeamAdmin(selectedTeam.id) &&
                      Number(u.id) !== Number(profile?.id);

                    return (
                      <span key={u.id} className="teams-invite__existing-chip">
                        <span
                          className="teams-invite__existing-avatar"
                          style={{ background: getAvatarColor(u.username) }}
                        >
                          {getInitials(u.username)}
                        </span>
                        {u.username}
                        {membership?.role === "ADMIN" && (
                          <Shield size={12} className="teams-invite__admin-badge" />
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            className="teams-invite__remove-member"
                            title={`Remove ${u.username}`}
                            onClick={() => handleRemoveMember(u.id, u.username)}
                            style={{ border: 'none', display: 'inline-flex', visibility: 'visible', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
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
                    value={filteredSelectedUserIds}
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
                disabled={inviteSubmitting || filteredSelectedUserIds.length === 0}
              >
                {inviteSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {filteredSelectedUserIds.length > 1
                      ? `Add ${filteredSelectedUserIds.length} Members`
                      : filteredSelectedUserIds.length === 1
                        ? "Add 1 Member"
                        : "Add Members"}
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </Modal>

      <Modal open={showGroupModal} onClose={() => setShowGroupModal(false)} title="Create Group">
        <form className="vtl-modal__form" onSubmit={handleCreateGroup}>
          {groupFormError && <div className="vtl-modal__error">{groupFormError}</div>}
          <label>
            Group name
            <input
              required
              minLength={3}
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="Engineering"
            />
          </label>
          <label>
            Description
            <textarea
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              placeholder="What does this group work on?"
            />
          </label>
          <div className="vtl-modal__actions">
            <button type="button" className="vtl-btn vtl-btn--ghost" onClick={() => setShowGroupModal(false)}>Cancel</button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={groupSubmitting}>
              {groupSubmitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showGroupInviteModal}
        onClose={() => setShowGroupInviteModal(false)}
        title={`Invite to ${selectedGroup?.name || "Group"}`}
        wide
        scrollable
      >
        <form className="vtl-modal__form teams-invite" onSubmit={handleGroupInvite}>
          <div className="teams-invite__scroll">
            {selectedGroup && (
              <div className="teams-invite__team">
                <div
                  className="teams-invite__team-icon"
                  style={{ background: getTeamGradient(selectedGroup.name) }}
                >
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </div>
                <div className="teams-invite__team-info">
                  <strong>{selectedGroup.name}</strong>
                  <span>
                    {`${groupMembers.length} current member${groupMembers.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            )}

            {groupMembers.length > 0 && (
              <div className="teams-invite__existing">
                <span className="teams-invite__label">Already in group</span>
                <div className="teams-invite__existing-list">
                  {groupMembers.map((m) => {
                    const user = Number(m.user) === Number(profile?.id) ? profile : users.find((u) => Number(u.id) === Number(m.user));
                    if (!user) return null;
                    const canRemove =
                      selectedGroup &&
                      (isGroupAdmin(selectedGroup.id) || Number(m.user) === Number(profile?.id));

                    return (
                      <span key={m.id} className="teams-invite__existing-chip">
                        <span
                          className="teams-invite__existing-avatar"
                          style={{ background: getAvatarColor(user.username) }}
                        >
                          {getInitials(user.username)}
                        </span>
                        {user.username}
                        {m.role === "ADMIN" && (
                          <Shield size={12} className="teams-invite__admin-badge" />
                        )}
                        {canRemove && (
                          <button
                            type="button"
                            className="teams-invite__remove-member"
                            title={`Remove ${user.username}`}
                            onClick={() => handleRemoveGroupMember(user.id, user.username)}
                            style={{ border: 'none', display: 'inline-flex', visibility: 'visible', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {groupInviteError && <div className="vtl-modal__error">{groupInviteError}</div>}

            {availableUsers.length === 0 ? (
              <EmptyState
                icon={<Users size={24} />}
                title="No users to invite"
                description="Everyone is already on this group, or no other accounts exist yet."
              />
            ) : (
              <>
                <div className="teams-invite__section">
                  <span className="teams-invite__label">Add members</span>
                  <SearchableMultiSelect
                    options={inviteUserOptions}
                    value={groupInviteUserIds}
                    onChange={setGroupInviteUserIds}
                    placeholder="Search by name or email..."
                    emptyMessage="No users match your search"
                  />
                </div>

                <div className="teams-invite__section">
                  <span className="teams-invite__label">Role for all selected</span>
                  <div className="teams-invite__roles">
                    {[
                      { value: "MEMBER", label: "Member", desc: "Can chat and view channels" },
                      { value: "ADMIN", label: "Admin", desc: "Can manage group and invites" },
                    ].map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        className={`teams-invite__role ${
                          groupInviteRole === role.value ? "teams-invite__role--active" : ""
                        }`}
                        onClick={() => setGroupInviteRole(role.value)}
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

          {availableUsers.length > 0 && (
            <div className="teams-invite__footer vtl-modal__actions">
              <button
                type="button"
                className="vtl-btn vtl-btn--ghost"
                onClick={() => setShowGroupInviteModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="vtl-btn vtl-btn--primary"
                disabled={groupInviteSubmitting || groupInviteUserIds.length === 0}
              >
                {groupInviteSubmitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {groupInviteUserIds.length > 1
                      ? `Add ${groupInviteUserIds.length} Members`
                      : groupInviteUserIds.length === 1
                        ? "Add 1 Member"
                        : "Add Members"}
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </Modal>
    </AppLayout>
  );
}

