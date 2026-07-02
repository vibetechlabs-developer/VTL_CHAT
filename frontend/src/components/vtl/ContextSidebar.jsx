import { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Hash,
  Lock,
  Bell,
  UserPlus,
  Video,
  Users,
  Shield,
  Loader2
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { getAvatarColor, getInitials, extractErrorMessage, getTeamGradient } from "../../utils/helpers";
import Modal from "./Modal";
import SearchableMultiSelect from "./SearchableMultiSelect";
import * as workspaceApi from "../../services/workspaceApi";
import "./ContextSidebar.scss";

export default function ContextSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    teams,
    channels,
    users,
    profile,
    notifications,
    meetings,
    createChannel,
    createDirectMessageChannel,
    createTeam,
    addTeamMember,
    markNotificationRead,
    markAllNotificationsRead,
  } = useWorkspace();

  const [expandedTeams, setExpandedTeams] = useState(() => {
    // Expand first team by default if exists
    return teams.length > 0 ? { [teams[0].id]: true } : {};
  });

  // Modal states
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Forms state
  const [teamForm, setTeamForm] = useState({ name: "", description: "", team_type: "PUBLIC" });
  const [channelForm, setChannelForm] = useState({ name: "", description: "", team: "", channel_type: "PUBLIC" });
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteTeamMembers, setInviteTeamMembers] = useState([]);
  const [inviteMembersLoading, setInviteMembersLoading] = useState(false);

  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/notifications")) return "activity";
    if (path.startsWith("/chat")) return "chat";
    if (path.startsWith("/teams")) return "teams";
    if (path.startsWith("/meetings")) return "meetings";
    return "";
  }, [location.pathname]);

  const toggleTeam = (teamId) => {
    setExpandedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  // Helper to extract active channel id from URL
  const activeChannelId = useMemo(() => {
    const parts = location.pathname.split("/");
    if (location.pathname.startsWith("/teams/")) {
      // /teams/:teamId/channels/:channelId
      return parts[4] ? Number(parts[4]) : null;
    } else if (location.pathname.startsWith("/chat/dm/")) {
      // /chat/dm/:channelId
      return parts[3] ? Number(parts[3]) : null;
    }
    return null;
  }, [location.pathname]);

  const getDMName = (channel) => {
    if (!channel.members || channel.members.length === 0) return channel.name;
    const otherId = channel.members.find((id) => id !== profile?.id) || profile?.id;
    const otherUser = users.find((u) => u.id === otherId);
    return otherUser ? otherUser.username : channel.name;
  };

  const handleCreateTeamSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const orgsRes = await workspaceApi.getOrganizations();
      let orgId = orgsRes.data?.[0]?.id;
      if (!orgId) {
        const orgRes = await workspaceApi.createOrganization({
          name: "My Workspace",
          description: "VTL Chat workspace",
        });
        orgId = orgRes.data.id;
      }
      const newTeam = await createTeam({
        name: teamForm.name,
        description: teamForm.description,
        organization: orgId,
        team_type: teamForm.team_type,
      });
      setShowCreateTeam(false);
      setTeamForm({ name: "", description: "", team_type: "PUBLIC" });
      navigate(`/teams/${newTeam.id}/channels/default`);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const teamId = channelForm.team || selectedTeam?.id || teams[0]?.id;
      if (!teamId) {
        setFormError("A team is required.");
        return;
      }
      const ch = await createChannel({
        name: channelForm.name,
        description: channelForm.description,
        team: Number(teamId),
        channel_type: channelForm.channel_type,
      });
      setShowCreateChannel(false);
      setChannelForm({ name: "", description: "", team: "", channel_type: "PUBLIC" });
      navigate(`/teams/${teamId}/channels/${ch.id}`);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const loadInviteMembers = async (teamId) => {
    setInviteMembersLoading(true);
    try {
      const res = await workspaceApi.getTeamMembers(teamId);
      setInviteTeamMembers(res.data);
    } catch (err) {
      console.error(err);
      setInviteTeamMembers([]);
    } finally {
      setInviteMembersLoading(false);
    }
  };

  const openInvite = (team) => {
    setSelectedTeam(team);
    setSelectedUserIds([]);
    setInviteRole("MEMBER");
    setFormError("");
    setInviteTeamMembers([]);
    setShowInviteModal(true);
    loadInviteMembers(team.id);
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      setFormError("Please select at least one user.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      await Promise.all(
        selectedUserIds.map((userId) =>
          addTeamMember({
            team: selectedTeam.id,
            user: userId,
            role: inviteRole,
          })
        )
      );
      setShowInviteModal(false);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartDM = async (userId) => {
    try {
      const dmChannel = await createDirectMessageChannel(userId);
      setShowNewDM(false);
      navigate(`/chat/dm/${dmChannel.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter available users for invites
  const availableInviteUsers = useMemo(() => {
    if (!selectedTeam) return [];
    const memberIds = new Set(inviteTeamMembers.map((m) => Number(m.user)));
    return users.filter(
      (u) => Number(u.id) !== Number(profile?.id) && !memberIds.has(Number(u.id))
    );
  }, [users, inviteTeamMembers, selectedTeam, profile]);

  const inviteOptions = useMemo(
    () => availableInviteUsers.map((u) => ({ id: u.id, label: u.username, sublabel: u.email })),
    [availableInviteUsers]
  );

  if (!activeTab) return null;

  return (
    <aside className="context-sidebar">
      {/* Pane Header */}
      <div className="context-sidebar__header">
        {activeTab === "teams" && (
          <>
            <h2>Teams</h2>
            <button
              className="context-sidebar__add-btn"
              title="Create Team"
              onClick={() => setShowCreateTeam(true)}
            >
              <Plus size={16} />
            </button>
          </>
        )}
        {activeTab === "chat" && (
          <>
            <h2>Chat</h2>
            <button
              className="context-sidebar__add-btn"
              title="New Chat"
              onClick={() => setShowNewDM(true)}
            >
              <Plus size={16} />
            </button>
          </>
        )}
        {activeTab === "activity" && (
          <>
            <h2>Activity</h2>
            {notifications.some((n) => !n.is_read) && (
              <button
                className="context-sidebar__read-btn"
                title="Mark all read"
                onClick={markAllNotificationsRead}
              >
                Mark all read
              </button>
            )}
          </>
        )}
        {activeTab === "meetings" && <h2>Calendar</h2>}
      </div>

      {/* Pane Scroll Body */}
      <div className="context-sidebar__body">
        {/* ================= TEAMS TAB ================= */}
        {activeTab === "teams" && (
          <div className="context-sidebar__teams-tree">
            {teams.length === 0 ? (
              <div className="context-sidebar__empty">
                <Users size={20} />
                <p>No teams yet.</p>
                <button
                  className="vtl-btn vtl-btn--primary vtl-btn--xs"
                  onClick={() => setShowCreateTeam(true)}
                >
                  Create Team
                </button>
              </div>
            ) : (
              teams.map((team) => {
                const isExpanded = !!expandedTeams[team.id];
                const teamChannels = channels.filter(
                  (c) => c.team === team.id && c.channel_type !== "DIRECT"
                );

                return (
                  <div key={team.id} className="context-sidebar__team-node">
                    <div className="context-sidebar__team-row">
                      <button
                        className="context-sidebar__toggle"
                        onClick={() => toggleTeam(team.id)}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      <div
                        className="context-sidebar__team-icon"
                        style={{ background: getTeamGradient(team.name) }}
                      >
                        {team.name.charAt(0).toUpperCase()}
                      </div>

                      <span className="context-sidebar__team-name" title={team.name}>
                        {team.name}
                      </span>

                      <div className="context-sidebar__team-actions">
                        <button
                          title="Invite Members"
                          onClick={() => openInvite(team)}
                        >
                          <UserPlus size={12} />
                        </button>
                        <button
                          title="Create Channel"
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowCreateChannel(true);
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="context-sidebar__team-channels">
                        {teamChannels.length === 0 ? (
                          <div className="context-sidebar__empty-ch">No channels</div>
                        ) : (
                          teamChannels.map((ch) => (
                            <Link
                              key={ch.id}
                              to={`/teams/${team.id}/channels/${ch.id}`}
                              className={`context-sidebar__channel-link ${
                                activeChannelId === ch.id
                                  ? "context-sidebar__channel-link--active"
                                  : ""
                              }`}
                            >
                              {ch.channel_type === "PRIVATE" ? (
                                <Lock size={12} className="context-sidebar__ch-icon" />
                              ) : (
                                <Hash size={12} className="context-sidebar__ch-icon" />
                              )}
                              <span>{ch.name}</span>
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= CHAT TAB ================= */}
        {activeTab === "chat" && (
          <div className="context-sidebar__dm-list">
            <span className="context-sidebar__section-title">Direct Messages</span>
            {channels.filter((c) => c.channel_type === "DIRECT").length === 0 ? (
              <div className="context-sidebar__empty">
                <p>No chat history yet.</p>
                <button
                  className="vtl-btn vtl-btn--primary vtl-btn--xs"
                  onClick={() => setShowNewDM(true)}
                >
                  Start a Chat
                </button>
              </div>
            ) : (
              channels
                .filter((c) => c.channel_type === "DIRECT")
                .map((ch) => {
                  const dmName = getDMName(ch);
                  return (
                    <Link
                      key={ch.id}
                      to={`/chat/dm/${ch.id}`}
                      className={`context-sidebar__dm-row ${
                        activeChannelId === ch.id ? "context-sidebar__dm-row--active" : ""
                      }`}
                    >
                      <div
                        className="context-sidebar__dm-avatar"
                        style={{ background: getAvatarColor(dmName) }}
                      >
                        {getInitials(dmName)}
                      </div>
                      <span className="context-sidebar__dm-name">{dmName}</span>
                    </Link>
                  );
                })
            )}
          </div>
        )}

        {/* ================= ACTIVITY TAB ================= */}
        {activeTab === "activity" && (
          <div className="context-sidebar__notif-list">
            {notifications.length === 0 ? (
              <div className="context-sidebar__empty">
                <Bell size={20} />
                <p>All caught up!</p>
              </div>
            ) : (
              [...notifications]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((n) => (
                  <div
                    key={n.id}
                    className={`context-sidebar__notif-row ${
                      !n.is_read ? "context-sidebar__notif-row--unread" : ""
                    }`}
                    onClick={() => {
                      if (!n.is_read) markNotificationRead(n.id);
                      if (n.notification_type === "MESSAGE" || n.notification_type === "MENTION") {
                        navigate("/chat");
                      } else if (n.notification_type === "MEETING") {
                        navigate("/meetings");
                      }
                    }}
                  >
                    <div className="context-sidebar__notif-meta">
                      <strong>{n.title}</strong>
                      <span className="context-sidebar__notif-dot" />
                    </div>
                    <p>{n.message}</p>
                  </div>
                ))
            )}
          </div>
        )}

        {/* ================= MEETINGS TAB ================= */}
        {activeTab === "meetings" && (
          <div className="context-sidebar__meetings-list">
            <span className="context-sidebar__section-title">Scheduled Meetings</span>
            {meetings.length === 0 ? (
              <div className="context-sidebar__empty">
                <Video size={20} />
                <p>No meetings scheduled.</p>
              </div>
            ) : (
              [...meetings]
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                .map((m) => {
                  const isUpcoming = new Date(m.start_time) >= new Date();
                  return (
                    <div key={m.id} className="context-sidebar__meeting-row">
                      <div className="context-sidebar__meeting-header">
                        <strong>{m.title}</strong>
                        <span
                          className={`context-sidebar__meeting-badge ${
                            isUpcoming ? "upcoming" : "past"
                          }`}
                        >
                          {isUpcoming ? "upcoming" : "past"}
                        </span>
                      </div>
                      <span>
                        {new Date(m.start_time).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(m.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Create Team Modal */}
      <Modal open={showCreateTeam} onClose={() => setShowCreateTeam(false)} title="Create a Team">
        <form className="vtl-modal__form" onSubmit={handleCreateTeamSubmit}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Team Name
            <input
              required
              minLength={3}
              value={teamForm.name}
              onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
              placeholder="e.g. Engineering, Marketing"
            />
          </label>
          <label>
            Description
            <textarea
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
              placeholder="What does this team focus on?"
            />
          </label>
          <label>
            Visibility
            <select
              value={teamForm.team_type}
              onChange={(e) => setTeamForm({ ...teamForm, team_type: e.target.value })}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </label>
          <div className="vtl-modal__actions">
            <button
              type="button"
              className="vtl-btn vtl-btn--ghost"
              onClick={() => setShowCreateTeam(false)}
            >
              Cancel
            </button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Create Channel Modal */}
      <Modal open={showCreateChannel} onClose={() => setShowCreateChannel(false)} title="Create a Channel">
        <form className="vtl-modal__form" onSubmit={handleCreateChannelSubmit}>
          {formError && <div className="vtl-modal__error">{formError}</div>}
          <label>
            Channel Name
            <input
              required
              minLength={3}
              value={channelForm.name}
              onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
              placeholder="e.g. general, announcements"
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
            <button
              type="button"
              className="vtl-btn vtl-btn--ghost"
              onClick={() => setShowCreateChannel(false)}
            >
              Cancel
            </button>
            <button type="submit" className="vtl-btn vtl-btn--primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Invite Members Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={`Invite to ${selectedTeam?.name || "Team"}`}
        wide
        scrollable
      >
        <form className="vtl-modal__form" onSubmit={handleInviteSubmit}>
          {formError && <div className="vtl-modal__error">{formError}</div>}

          {inviteMembersLoading ? (
            <div className="teams-invite__loading">
              <Loader2 size={24} className="spin" />
              <span>Loading available users...</span>
            </div>
          ) : availableInviteUsers.length === 0 ? (
            <div className="context-sidebar__empty">
              <p>Everyone in the workspace is already in this team, or no other accounts exist.</p>
            </div>
          ) : (
            <>
              <div className="teams-invite__section">
                <span className="teams-invite__label">Add members</span>
                <SearchableMultiSelect
                  options={inviteOptions}
                  value={selectedUserIds}
                  onChange={setSelectedUserIds}
                  placeholder="Search by name or email..."
                  emptyMessage="No users match your search"
                />
              </div>

              <div className="teams-invite__section" style={{ marginTop: "1rem" }}>
                <span className="teams-invite__label">Role for selected users</span>
                <div className="teams-invite__roles" style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {[
                    { value: "MEMBER", label: "Member", desc: "Can view and chat in channels" },
                    { value: "ADMIN", label: "Admin", desc: "Can manage team settings/members" },
                  ].map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      className={`teams-invite__role ${
                        inviteRole === role.value ? "teams-invite__role--active" : ""
                      }`}
                      onClick={() => setInviteRole(role.value)}
                      style={{
                        flex: 1,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        padding: "0.5rem",
                        borderRadius: "8px",
                        color: "white",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Shield size={14} />
                        <strong>{role.label}</strong>
                      </div>
                      <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{role.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="vtl-modal__actions" style={{ marginTop: "1.5rem" }}>
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
              disabled={submitting || selectedUserIds.length === 0}
            >
              {submitting ? "Inviting..." : "Invite"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Start New DM Modal */}
      <Modal open={showNewDM} onClose={() => setShowNewDM(false)} title="New Chat">
        <div className="context-sidebar__new-dm">
          <span className="context-sidebar__section-title">Select a member to chat with</span>
          <div className="context-sidebar__new-dm-list">
            {users
              .filter((u) => u.id !== profile?.id)
              .map((u) => (
                <button
                  key={u.id}
                  className="context-sidebar__new-dm-user"
                  onClick={() => handleStartDM(u.id)}
                >
                  <div
                    className="context-sidebar__dm-avatar"
                    style={{ background: getAvatarColor(u.username) }}
                  >
                    {getInitials(u.username)}
                  </div>
                  <div className="context-sidebar__new-dm-info">
                    <strong>{u.username}</strong>
                    <span>{u.email}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </Modal>
    </aside>
  );
}
