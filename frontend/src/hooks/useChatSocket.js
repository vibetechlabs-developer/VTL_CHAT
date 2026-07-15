import { useEffect, useRef, useState, useCallback } from "react";
import { fetchWsTicket, getWsBaseUrl } from "../services/wsTicket";
import { getAccessToken, onAccessTokenChange } from "../services/api";

export function useChatSocket(channelId, onEvent, onReconnect) {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const socketRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => onAccessTokenChange(() => setAuthVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!channelId) {
      setTimeout(() => setConnectionStatus("disconnected"), 0);
      return;
    }

    let socket = null;
    let reconnectTimeoutId = null;
    let retryCount = 0;
    let isCleanUp = false;

    const connect = async () => {
      if (isCleanUp) return;

      if (!getAccessToken()) {
        setConnectionStatus("disconnected");
        return;
      }

      setConnectionStatus(retryCount > 0 ? "reconnecting" : "connecting");

      try {
        const ticket = await fetchWsTicket();
        if (isCleanUp) return;

        const wsUrl = `${getWsBaseUrl()}/ws/chat/${channelId}/?ticket=${encodeURIComponent(ticket)}`;
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

        socket.onclose = (event) => {
          if (isCleanUp) return;
          const closeCode = event ? event.code : null;
          if (closeCode === 4001 || closeCode === 4003 || closeCode === 4004) {
            setConnectionStatus("disconnected");
            window.location.href = "/";
            return;
          }
          socketRef.current = null;
          setConnectionStatus("disconnected");
          scheduleReconnect();
        };

        socket.onerror = () => {
          if (isCleanUp) return;
          socket.close();
        };
      } catch {
        if (!isCleanUp) scheduleReconnect();
      }
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
      if (socket) socket.close();
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
    };
  }, [channelId, authVersion]);

  const sendSocketMessage = useCallback((data) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }, []);

  return { connectionStatus, sendSocketMessage };
}
