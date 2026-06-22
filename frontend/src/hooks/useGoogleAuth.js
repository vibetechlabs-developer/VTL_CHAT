import { useEffect, useRef, useCallback } from "react";

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "google-gsi-script";

export function useGoogleAuth(onSuccess, onError) {
  const clientRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      if (!window.google?.accounts?.oauth2) return;

      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: (response) => {
          if (response.error) {
            onError?.(response.error);
            return;
          }
          onSuccess({ access_token: response.access_token });
        },
      });
    };

    if (document.getElementById(SCRIPT_ID)) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = GSI_SCRIPT;
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [onSuccess, onError]);

  const login = useCallback(() => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      onError?.("Google sign-in is not configured");
      return;
    }
    if (!clientRef.current) {
      onError?.("Google sign-in is still loading. Try again in a moment.");
      return;
    }
    clientRef.current.requestAccessToken({ prompt: "select_account" });
  }, [onError]);

  return {
    login,
    isConfigured: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID),
  };
}
