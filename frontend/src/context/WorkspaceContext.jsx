/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useSettings } from "./SettingsContext";
import { useGlobalSocket } from "../hooks/useGlobalSocket";
import { shouldShowDesktopNotification } from "../utils/appFocus";
import { AuthProvider, useAuth } from "./AuthContext";
import { WorkspaceDataProvider, useWorkspaceData } from "./WorkspaceDataContext";
import { ChatProvider, useChat } from "./ChatContext";

const WorkspaceContext = createContext(null);

function WorkspaceComposer({ children }) {
  const { profile, loading: authLoading, error: authError, initials, handleLogout, updateProfile, updateProfileAvatar } = useAuth();
  const workspace = useWorkspaceData();
  const chat = useChat();
  const { settings } = useSettings();

  const usersMap = useMemo(() => {
    const map = { ...Object.fromEntries(workspace.users.map((u) => [u.id, u])) };
    if (profile) map[profile.id] = profile;
    return map;
  }, [workspace.users, profile]);

  const handleGlobalEvent = useCallback((event) => {
    if (event?.type === "notification" && event.payload) {
      const n = event.payload;
      workspace.setNotifications((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev];
      });
      if (
        settings.desktopNotifications &&
        shouldShowDesktopNotification() &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(n.title || "New Notification", {
          body: n.message || "",
          icon: "/favicon.ico",
        });
      }
    }
  }, [workspace, settings.desktopNotifications]);

  useGlobalSocket(handleGlobalEvent);

  const prevNotificationsRef = useRef([]);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      if (workspace.notifications.length > 0) {
        prevNotificationsRef.current = workspace.notifications;
        isInitialLoadRef.current = false;
      }
      return;
    }

    if (settings.desktopNotifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const prevIds = new Set(prevNotificationsRef.current.map((p) => p.id));
    const newNotifs = workspace.notifications.filter((n) => !prevIds.has(n.id));

    newNotifs.forEach((n) => {
      if (
        settings.desktopNotifications &&
        shouldShowDesktopNotification() &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(n.title || "New Notification", {
          body: n.message || "",
          icon: "/favicon.ico",
        });
      }
    });

    prevNotificationsRef.current = workspace.notifications;
  }, [workspace.notifications, settings.desktopNotifications]);

  const toggleReaction = (messageId, reactionType) =>
    chat.toggleReaction(messageId, reactionType, profile?.id);

  const value = {
    profile,
    users: workspace.users,
    usersMap,
    teams: workspace.teams,
    organizations: workspace.organizations,
    teamMembers: workspace.teamMembers,
    channels: workspace.channels,
    meetings: workspace.meetings,
    notifications: workspace.notifications,
    messages: chat.messages,
    reactions: chat.reactions,
    loading: authLoading || workspace.loading,
    error: authError || workspace.error,
    initials,
    unreadNotificationCount: workspace.unreadNotificationCount,
    handleLogout,
    refreshAll: workspace.refreshWorkspaceData,
    updateProfile,
    updateProfileAvatar,
    createOrganization: workspace.createOrganization,
    createTeam: workspace.createTeam,
    deleteTeam: workspace.deleteTeam,
    createChannel: workspace.createChannel,
    deleteChannel: workspace.deleteChannel,
    createDirectMessageChannel: workspace.createDirectMessageChannel,
    createMeeting: workspace.createMeeting,
    deleteMeeting: workspace.deleteMeeting,
    fetchChannelMessages: chat.fetchChannelMessages,
    postMessage: chat.postMessage,
    editMessage: chat.editMessage,
    deleteMessage: chat.deleteMessage,
    clearChannelChat: chat.clearChannelChat,
    pinMessage: chat.pinMessage,
    markNotificationRead: workspace.markNotificationRead,
    markAllNotificationsRead: workspace.markAllNotificationsRead,
    joinMeeting: workspace.joinMeeting,
    getTeamMemberCount: workspace.getTeamMemberCount,
    getChannelCountForTeam: workspace.getChannelCountForTeam,
    addTeamMember: workspace.addTeamMember,
    joinTeam: workspace.joinTeam,
    leaveTeam: workspace.leaveTeam,
    removeTeamMember: workspace.removeTeamMember,
    toggleReaction,
    addReaction: toggleReaction,
    uploadMessageAttachment: chat.uploadMessageAttachment,
    setMessages: chat.setMessages,
    setReactions: chat.setReactions,
  };

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function WorkspaceProvider({ children }) {
  return (
    <AuthProvider>
      <WorkspaceDataProvider>
        <ChatProvider>
          <WorkspaceComposer>{children}</WorkspaceComposer>
        </ChatProvider>
      </WorkspaceDataProvider>
    </AuthProvider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
