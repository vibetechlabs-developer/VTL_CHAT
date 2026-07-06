import { useEffect, useRef, useState, useCallback } from "react";

const getWsBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured.replace(/\/$/, "");
  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const origin = apiUrl.replace(/\/api\/?$/, "");
  return origin.replace(/^http/, "ws");
};

/**
 * Global user-level WebSocket for receiving real-time events
 * (notifications, system alerts, etc.) without polling.
 */
export function useGlobalSocket(onEvent) {
  const onEventRef = useRef(onEvent);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    let socket = null;
    let reconnectTimeout = null;
    let retryCount = 0;
    let cleanedUp = false;

    const connect = () => {
      if (cleanedUp) return;

      const wsUrl = `${getWsBaseUrl()}/ws/events/?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (cleanedUp) { socket.close(); return; }
        setStatus("connected");
        retryCount = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEventRef.current?.(data);
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (cleanedUp) return;
        setStatus("disconnected");
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        reconnectTimeout = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        if (cleanedUp) return;
        socket.close();
      };
    };

    connect();

    return () => {
      cleanedUp = true;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return { globalSocketStatus: status };
}
