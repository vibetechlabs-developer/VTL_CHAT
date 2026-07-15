import { useEffect, useRef, useState } from "react";
import { fetchWsTicket, getWsBaseUrl } from "../services/wsTicket";
import { getAccessToken, onAccessTokenChange } from "../services/api";

export function useGlobalSocket(onEvent) {
  const onEventRef = useRef(onEvent);
  const [status, setStatus] = useState("disconnected");
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => onAccessTokenChange(() => setAuthVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!getAccessToken()) return;

    let socket = null;
    let reconnectTimeout = null;
    let retryCount = 0;
    let cleanedUp = false;

    const connect = async () => {
      if (cleanedUp) return;

      try {
        const ticket = await fetchWsTicket();
        if (cleanedUp) return;

        const wsUrl = `${getWsBaseUrl()}/ws/events/?ticket=${encodeURIComponent(ticket)}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (cleanedUp) {
            socket.close();
            return;
          }
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

        socket.onclose = (event) => {
          if (cleanedUp) return;
          const closeCode = event ? event.code : null;
          if (closeCode === 4001 || closeCode === 4003 || closeCode === 4004) {
            setStatus("disconnected");
            window.location.href = "/";
            return;
          }
          setStatus("disconnected");
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          reconnectTimeout = setTimeout(connect, delay);
        };

        socket.onerror = () => {
          if (cleanedUp) return;
          socket.close();
        };
      } catch {
        if (!cleanedUp) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          reconnectTimeout = setTimeout(connect, delay);
        }
      }
    };

    connect();

    return () => {
      cleanedUp = true;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [authVersion]);

  return { globalSocketStatus: status };
}
