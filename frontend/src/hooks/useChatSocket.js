import { useEffect, useRef, useState, useCallback } from "react";

const getWsBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured.replace(/\/$/, "");

  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const origin = apiUrl.replace(/\/api\/?$/, "");
  return origin.replace(/^http/, "ws");
};

export function useChatSocket(channelId, onEvent, onReconnect) {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!channelId) {
      setTimeout(() => setConnectionStatus("disconnected"), 0);
      return;
    }

    let socket = null;
    let reconnectTimeoutId = null;
    let retryCount = 0;
    let isCleanUp = false;

    const connect = () => {
      if (isCleanUp) return;

      const token = localStorage.getItem("access");
      if (!token) {
        setConnectionStatus("disconnected");
        return;
      }

      setConnectionStatus(retryCount > 0 ? "reconnecting" : "connecting");

      const wsUrl = `${getWsBaseUrl()}/ws/chat/${channelId}/?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (isCleanUp) {
          socket.close();
          return;
        }
        setConnectionStatus("connected");
        if (retryCount > 0) {
          onReconnectRef.current?.();
        }
        retryCount = 0;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onEventRef.current?.(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (isCleanUp) return;
        console.warn('WebSocket closed, attempting reconnect');
        socketRef.current = null;
        setConnectionStatus("disconnected");
        scheduleReconnect();
      };

      socket.onerror = (event) => {
        if (isCleanUp) return;
        console.error('WebSocket error, closing socket', event);
        socket.close();
      };
    };

    const scheduleReconnect = () => {
      if (isCleanUp) return;
      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      reconnectTimeoutId = setTimeout(connect, delay);
    };

    connect();

    return () => {
      isCleanUp = true;
      socketRef.current = null;
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
    };
  }, [channelId]);

  /**
   * Send a raw JSON message over the WebSocket.
   * @param {object} data – plain JS object to send
   */
  const sendSocketMessage = useCallback((data) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }, []);

  return { connectionStatus, sendSocketMessage };
}
