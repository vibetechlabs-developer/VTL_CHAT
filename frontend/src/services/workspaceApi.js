import api from "./api";

export const getProfile = () => api.get("/users/profile/");
export const getUsers = () => api.get("/users/");
export const updateUser = (id, data) => api.put(`/users/${id}/`, data);
export const updateUserAvatar = (id, file) => {
  const form = new FormData();
  form.append("avatar", file);
  return api.put(`/users/${id}/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const logoutUser = () => api.post("/users/logout/");

export const getWsTicket = () => api.post("/users/ws-ticket/");

export const getProfileStats = () => api.get("/users/profile/stats/");

export const getNotificationPreferences = () => api.get("/users/notification-preferences/");

export const updateNotificationPreferences = (data) =>
  api.put("/users/notification-preferences/", data);

export const getReactionChoices = () => api.get("/messages/reactions/choices/");

export const deleteTeam = (id) => api.delete(`/teams/${id}/`);

export const deleteChannel = (id) => api.delete(`/teams/channels/${id}/`);

export const deleteMeeting = (id) => api.delete(`/meetings/${id}/`);

export const getOrganizations = () => api.get("/teams/organizations/");
export const createOrganization = (data) => api.post("/teams/organizations/", data);

export const getTeams = () => api.get("/teams/");
export const createTeam = (data) => api.post("/teams/", data);
export const getTeamMembers = (teamId) =>
  api.get("/teams/team-members/", { params: teamId ? { team: teamId } : {} });
export const addTeamMember = (data) => api.post("/teams/team-members/", data);
export const joinTeam = (teamId) =>
  api.post("/teams/team-members/", { team: teamId, role: "MEMBER" });
export const removeTeamMember = (teamId, userId) =>
  api.delete(`/teams/team-members/${teamId}/${userId}/`);
export const leaveTeam = (teamId, userId) => removeTeamMember(teamId, userId);

export const getChannels = () => api.get("/teams/channels/");
export const createChannel = (data) => api.post("/teams/channels/", data);
export const createDirectChannel = (data) => api.post("/teams/channels/direct/", data);

export const getGroups = (teamId) =>
  api.get("/teams/groups/", { params: teamId ? { team: teamId } : {} });
export const createGroup = (data) => api.post("/teams/groups/", data);
export const updateGroup = (id, data) => api.put(`/teams/groups/${id}/`, data);
export const deleteGroup = (id) => api.delete(`/teams/groups/${id}/`);
export const getGroupMembers = (groupId) =>
  api.get("/teams/group-members/", { params: groupId ? { group: groupId } : {} });
export const addGroupMember = (data) => api.post("/teams/group-members/", data);
export const removeGroupMember = (groupId, userId) =>
  api.delete(`/teams/group-members/${groupId}/${userId}/`);
export const joinGroup = (groupId) =>
  api.post("/teams/group-members/", { group: groupId, role: "MEMBER" });
export const leaveGroup = (groupId, userId) => removeGroupMember(groupId, userId);

export const getMessages = (channelId, parentId = null, cursorOrParams = null) => {
  if (typeof cursorOrParams === "string") {
    return api.get(cursorOrParams);
  }
  const extra = cursorOrParams && typeof cursorOrParams === "object" ? cursorOrParams : {};
  return api.get("/messages/", {
    params: {
      ...(channelId ? { channel: channelId } : {}),
      ...(parentId ? { parent: parentId } : {}),
      ...extra,
    },
  });
};
export const sendMessage = (data) => api.post("/messages/", data);
export const editMessage = (messageId, data) => api.put(`/messages/${messageId}/`, data);
export const deleteMessage = (messageId) => api.delete(`/messages/${messageId}/`);
export const pinMessage = (messageId) => api.post(`/messages/${messageId}/pin/`);
export const clearChat = (channelId) => api.post("/messages/clear/", { channel: channelId });
export const getReactions = (channelId, cursorUrl = null) => {
  if (cursorUrl) return api.get(cursorUrl);
  return api.get("/messages/reactions/", { params: channelId ? { channel: channelId } : {} });
};
export const addReaction = (data) => api.post("/messages/reactions/", data);
export const updateReaction = (id, data) => api.put(`/messages/reactions/${id}/`, data);
export const removeReaction = (id) => api.delete(`/messages/reactions/${id}/`);

export const getAttachments = (channelId, cursorUrl = null) => {
  if (cursorUrl) return api.get(cursorUrl);
  return api.get("/messages/attachments/", { params: channelId ? { channel: channelId } : {} });
};
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
export const updateParticipantStatus = (meetingId, participantId, data) =>
  api.put(`/meetings/${meetingId}/participants/${participantId}/`, data);

export const sendReadReceipt = (channelId, messageId) =>
  api.post("/messages/read-receipt/", { channel: channelId, message: messageId });

export const getNotifications = () => api.get("/notifications/");
export const updateNotification = (id, data) => api.put(`/notifications/${id}/`, data);
