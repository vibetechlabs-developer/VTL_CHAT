import api from "./api";

export async function fetchWsTicket() {
  const { data } = await api.post("/users/ws-ticket/");
  return data.ticket;
}

export function getWsBaseUrl() {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured.replace(/\/$/, "");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  const origin = apiUrl.replace(/\/api\/?$/, "");
  return origin.replace(/^http/, "ws");
}
