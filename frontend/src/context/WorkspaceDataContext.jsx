/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as workspaceApi from "../services/workspaceApi";
import { extractErrorMessage } from "../utils/helpers";

const WorkspaceDataContext = createContext(null);

export function WorkspaceDataProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshWorkspaceData = useCallback(async () => {
    const results = await Promise.allSettled([
      workspaceApi.getUsers(),
      workspaceApi.getTeams(),
      workspaceApi.getOrganizations(),
      workspaceApi.getTeamMembers(),
      workspaceApi.getChannels(),
      workspaceApi.getMeetings(),
      workspaceApi.getNotifications(),
    ]);

    const get = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
    if (get(0)) setUsers(get(0));
    if (get(1)) setTeams(get(1));
    if (get(2)) setOrganizations(get(2));
    if (get(3)) setTeamMembers(get(3));
    if (get(4)) setChannels(get(4));
    if (get(5)) setMeetings(get(5));
    if (get(6)) setNotifications(get(6));

    const firstError = results.find((r) => r.status === "rejected");
    if (firstError) throw firstError.reason;
  }, []);

  useEffect(() => {
    refreshWorkspaceData()
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
    const interval = setInterval(refreshWorkspaceData, 120000);
    return () => clearInterval(interval);
  }, [refreshWorkspaceData]);

  const createOrganization = async (data) => {
    const res = await workspaceApi.createOrganization(data);
    setOrganizations((prev) => [...prev, res.data]);
    return res.data;
  };

  const createTeam = async (data) => {
    const res = await workspaceApi.createTeam(data);
    setTeams((prev) => [...prev, res.data]);
    const membersRes = await workspaceApi.getTeamMembers(res.data.id);
    setTeamMembers((prev) => [...prev, ...membersRes.data]);
    return res.data;
  };

  const deleteTeam = async (teamId) => {
    await workspaceApi.deleteTeam(teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setTeamMembers((prev) => prev.filter((m) => m.team !== teamId));
    setChannels((prev) => prev.filter((c) => c.team !== teamId));
  };

  const createChannel = async (data) => {
    const res = await workspaceApi.createChannel(data);
    setChannels((prev) => [...prev, res.data]);
    return res.data;
  };

  const deleteChannel = async (channelId) => {
    await workspaceApi.deleteChannel(channelId);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
  };

  const createDirectMessageChannel = async (userId) => {
    const res = await workspaceApi.createDirectChannel({ user_id: userId });
    setChannels((prev) => {
      if (prev.some((c) => c.id === res.data.id)) return prev;
      return [...prev, res.data];
    });
    return res.data;
  };

  const createMeeting = async (data) => {
    const res = await workspaceApi.createMeeting(data);
    setMeetings((prev) => [...prev, res.data]);
    return res.data;
  };

  const deleteMeeting = async (meetingId) => {
    await workspaceApi.deleteMeeting(meetingId);
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  const addTeamMember = async (data) => {
    const res = await workspaceApi.addTeamMember(data);
    setTeamMembers((prev) => [...prev, res.data]);
    return res.data;
  };

  const joinTeam = async (teamId) => {
    const res = await workspaceApi.joinTeam(teamId);
    setTeamMembers((prev) => [...prev, res.data]);
    return res.data;
  };

  const leaveTeam = async (teamId, userId) => {
    await workspaceApi.leaveTeam(teamId, userId);
    setTeamMembers((prev) =>
      prev.filter((m) => !(Number(m.team) === Number(teamId) && Number(m.user) === Number(userId)))
    );
  };

  const removeTeamMember = async (teamId, userId) => {
    await workspaceApi.removeTeamMember(teamId, userId);
    setTeamMembers((prev) =>
      prev.filter((m) => !(Number(m.team) === Number(teamId) && Number(m.user) === Number(userId)))
    );
  };

  const joinMeeting = async (meetingId) => {
    await workspaceApi.joinMeeting(meetingId);
    const res = await workspaceApi.getMeetings();
    setMeetings(res.data);
  };

  const markNotificationRead = async (id) => {
    const res = await workspaceApi.updateNotification(id, { is_read: true });
    setNotifications((prev) => prev.map((n) => (n.id === id ? res.data : n)));
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) => workspaceApi.updateNotification(n.id, { is_read: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getTeamMemberCount = (teamId) =>
    teamMembers.filter((m) => Number(m.team) === Number(teamId)).length;

  const getChannelCountForTeam = (teamId) =>
    channels.filter((c) => c.team === teamId).length;

  const unreadNotificationCount = notifications.filter((n) => !n.is_read).length;

  const value = {
    users,
    teams,
    organizations,
    teamMembers,
    channels,
    meetings,
    notifications,
    loading,
    error,
    setNotifications,
    refreshWorkspaceData,
    createOrganization,
    createTeam,
    deleteTeam,
    createChannel,
    deleteChannel,
    createDirectMessageChannel,
    createMeeting,
    deleteMeeting,
    addTeamMember,
    joinTeam,
    leaveTeam,
    removeTeamMember,
    joinMeeting,
    markNotificationRead,
    markAllNotificationsRead,
    getTeamMemberCount,
    getChannelCountForTeam,
    unreadNotificationCount,
  };

  return (
    <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>
  );
}

export function useWorkspaceData() {
  const ctx = useContext(WorkspaceDataContext);
  if (!ctx) throw new Error("useWorkspaceData must be used within WorkspaceDataProvider");
  return ctx;
}
