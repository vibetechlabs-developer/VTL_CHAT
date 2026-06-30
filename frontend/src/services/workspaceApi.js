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
export const addTeamMember = (data) => api.post("/teams/team-members/", data);

export const getChannels = () => api.get("/teams/channels/");
export const createChannel = (data) => api.post("/teams/channels/", data);
export const createDirectChannel = (data) => api.post("/teams/channels/direct/", data);

export const getMessages = (channelId) =>
  api.get("/messages/", { params: channelId ? { channel: channelId } : {} });
export const sendMessage = (data) => api.post("/messages/", data);
export const editMessage = (messageId, data) => api.put(`/messages/${messageId}/`, data);
export const deleteMessage = (messageId) => api.delete(`/messages/${messageId}/`);
export const pinMessage = (messageId) => api.post(`/messages/${messageId}/pin/`);
export const clearChat = (channelId) => api.post("/messages/clear/", { channel: channelId });
export const getReactions = (channelId) =>
  api.get("/messages/reactions/", { params: channelId ? { channel: channelId } : {} });
export const addReaction = (data) => api.post("/messages/reactions/", data);
export const updateReaction = (id, data) => api.put(`/messages/reactions/${id}/`, data);
export const removeReaction = (id) => api.delete(`/messages/reactions/${id}/`);

export const getAttachments = (channelId) =>
  api.get("/messages/attachments/", { params: channelId ? { channel: channelId } : {} });
export const uploadAttachment = (messageId, file) => {
  const form = new FormData();
  form.append("message", messageId);
  form.append("file", file);
  return api.post("/messages/attachments/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getMeetings = () => api.get("/meetings/");
export const createMeeting = (data) => api.post("/meetings/", data);
export const joinMeeting = (meetingId, data = {}) =>
  api.post(`/meetings/${meetingId}/participants/`, data);
export const getMeetingParticipants = (meetingId) =>
  api.get(`/meetings/${meetingId}/participants/`);

export const getNotifications = () => api.get("/notifications/");
export const updateNotification = (id, data) => api.put(`/notifications/${id}/`, data);
