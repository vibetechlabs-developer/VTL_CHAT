const AVATAR_COLORS = ["#7C3AED", "#2563EB", "#10B981", "#EC4899", "#F59E0B", "#6366F1", "#06B6D4"];

export function getInitials(name = "") {
  if (!name) return "VT";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function getAvatarColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getTeamGradient(name = "") {
  const color = getAvatarColor(name);
  return `linear-gradient(135deg, ${color}, ${color}99)`;
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMessageTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today at ${time}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` at ${time}`;
}

export function formatMeetingDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMeetingTime(startStr, endStr) {
  if (!startStr) return "";
  const start = new Date(startStr);
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!endStr) return startTime;
  const end = new Date(endStr);
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startTime} – ${endTime}`;
}

export function groupReactions(reactions = [], usersMap = {}) {
  const groups = {};
  reactions.forEach((r) => {
    const key = r.reaction_type;
    if (!groups[key]) groups[key] = { type: key, count: 0, users: [] };
    groups[key].count += 1;
    groups[key].users.push(usersMap[r.user]?.username || "User");
  });
  return Object.values(groups);
}

export const REACTION_EMOJI = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  CELEBRATE: "🎉",
};

export const REACTION_TYPES = Object.keys(REACTION_EMOJI);

export function getMediaUrl(filePath) {
  if (!filePath) return "";
  if (filePath.startsWith("http")) return filePath;
  const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/api\/?$/, "");
  return `${base}${filePath.startsWith("/") ? filePath : `/${filePath}`}`;
}

export function getFileName(filePath) {
  if (!filePath) return "file";
  return filePath.split("/").pop() || "file";
}

export const NOTIFICATION_ICONS = {
  MESSAGE: "message",
  MEETING: "meeting",
  MENTION: "mention",
  TEAM: "invite",
  CHANNEL: "message",
  SYSTEM: "system",
};

export function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) return data[firstKey][0];
  if (firstKey) return String(data[firstKey]);
  return "Something went wrong. Please try again.";
}
