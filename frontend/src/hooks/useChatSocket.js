import { useEffect, useRef } from "react";

const getWsBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured.replace(/\/$/, "");

  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const origin = apiUrl.replace(/\/api\/?$/, "");
  return origin.replace(/^http/, "ws");
};

export function useChatSocket(channelId, onEvent) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!channelId) return;

    const token = localStorage.getItem("access");
    if (!token) return;

    const wsUrl = `${getWsBaseUrl()}/ws/chat/${channelId}/?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onEventRef.current?.(payload);
      } catch {
        // ignore malformed payloads
      }
    };

    return () => ws.close();
  }, [channelId]);
}
