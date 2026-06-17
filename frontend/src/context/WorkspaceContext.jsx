import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as workspaceApi from "../services/workspaceApi";
import { extractErrorMessage } from "../utils/helpers";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const usersMap = useMemo(() => {
    const map = { ...Object.fromEntries(users.map((u) => [u.id, u])) };
    if (profile) map[profile.id] = profile;
    return map;
  }, [users, profile]);

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled([
      workspaceApi.getProfile(),
      workspaceApi.getUsers(),
      workspaceApi.getTeams(),
      workspaceApi.getOrganizations(),
      workspaceApi.getTeamMembers(),
      workspaceApi.getChannels(),
      workspaceApi.getMeetings(),
      workspaceApi.getNotifications(),
      workspaceApi.getMessages(),
      workspaceApi.getReactions(),
    ]);

    const get = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);

    const profileData = get(0);
    if (profileData) setProfile(profileData);
    if (get(1)) setUsers(get(1));
    if (get(2)) setTeams(get(2));
    if (get(3)) setOrganizations(get(3));
    if (get(4)) setTeamMembers(get(4));
    if (get(5)) setChannels(get(5));
    if (get(6)) setMeetings(get(6));
    if (get(7)) setNotifications(get(7));
    if (get(8)) setMessages(get(8));
    if (get(9)) setReactions(get(9));

    if (!profileData && results[0].status === "rejected") {
      throw results[0].reason;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await refreshAll();
      } catch (err) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          navigate("/");
          return;
        }
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    init();
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [navigate, refreshAll]);

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh");
      if (refresh) await workspaceApi.logoutUser(refresh);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      navigate("/");
    }
  };

  const updateProfile = async (data) => {
    const res = await workspaceApi.updateUser(profile.id, data);
    setProfile(res.data);
    return res.data;
  };

  const createOrganization = async (data) => {
    const res = await workspaceApi.createOrganization(data);
    setOrganizations((prev) => [...prev, res.data]);
    return res.data;
  };

  const createTeam = async (data) => {
    const res = await workspaceApi.createTeam(data);
    await refreshAll();
    return res.data;
  };

  const createChannel = async (data) => {
    const res = await workspaceApi.createChannel(data);
    await refreshAll();
    return res.data;
  };

  const createMeeting = async (data) => {
    const res = await workspaceApi.createMeeting(data);
    setMeetings((prev) => [...prev, res.data]);
    return res.data;
  };

  const fetchChannelMessages = async (channelId) => {
    const res = await workspaceApi.getMessages(channelId);
    return res.data;
  };

  const postMessage = async (channelId, content) => {
    const res = await workspaceApi.sendMessage({ channel: channelId, content });
    setMessages((prev) => [...prev, res.data]);
    return res.data;
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

  const joinMeeting = async (meetingId) => {
    await workspaceApi.joinMeeting(meetingId);
    await refreshAll();
  };

  const getTeamMemberCount = (teamId) =>
    teamMembers.filter((m) => m.team === teamId).length;

  const getChannelCountForTeam = (teamId) =>
    channels.filter((c) => c.team === teamId).length;

  const unreadNotificationCount = notifications.filter((n) => !n.is_read).length;

  const initials = profile?.username ? profile.username.substring(0, 2).toUpperCase() : "VT";

  const value = {
    profile,
    users,
    usersMap,
    teams,
    organizations,
    teamMembers,
    channels,
    meetings,
    notifications,
    messages,
    reactions,
    loading,
    error,
    initials,
    unreadNotificationCount,
    handleLogout,
    refreshAll,
    updateProfile,
    createOrganization,
    createTeam,
    createChannel,
    createMeeting,
    fetchChannelMessages,
    postMessage,
    markNotificationRead,
    markAllNotificationsRead,
    joinMeeting,
    getTeamMemberCount,
    getChannelCountForTeam,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
