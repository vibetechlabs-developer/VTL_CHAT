import api from "./api";

export const getProfile = () => api.get("/users/profile/");
export const getUsers = () => api.get("/users/");
export const updateUser = (id, data) => api.put(`/users/${id}/`, data);
export const logoutUser = (refresh) => api.post("/users/logout/", { refresh });

export const getOrganizations = () => api.get("/teams/organizations/");
export const createOrganization = (data) => api.post("/teams/organizations/", data);

export const getTeams = () => api.get("/teams/");
export const createTeam = (data) => api.post("/teams/", data);
export const getTeamMembers = (teamId) =>
  api.get("/teams/team-members/", { params: teamId ? { team: teamId } : {} });

export const getChannels = () => api.get("/teams/channels/");
export const createChannel = (data) => api.post("/teams/channels/", data);

export const getMessages = (channelId) =>
  api.get("/messages/", { params: channelId ? { channel: channelId } : {} });
export const sendMessage = (data) => api.post("/messages/", data);
export const getReactions = () => api.get("/messages/reactions/");
export const addReaction = (data) => api.post("/messages/reactions/", data);

export const getMeetings = () => api.get("/meetings/");
export const createMeeting = (data) => api.post("/meetings/", data);
export const joinMeeting = (meetingId, data = {}) =>
  api.post(`/meetings/${meetingId}/participants/`, data);
export const getMeetingParticipants = (meetingId) =>
  api.get(`/meetings/${meetingId}/participants/`);

export const getNotifications = () => api.get("/notifications/");
export const updateNotification = (id, data) => api.put(`/notifications/${id}/`, data);
