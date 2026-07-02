/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  darkMode: true,
  compactMode: false,
  desktopNotifications: false,
  emailDigest: false,
  twoFactorAuth: false,
  showOnlineStatus: true,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("vtl_settings");
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("vtl_settings", JSON.stringify(updated));
      return updated;
    });
  };

  const isSettingKey = (key) => {
    return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
  };

  // Apply compact mode
  useEffect(() => {
    if (settings.compactMode) {
      document.body.classList.add("compact-mode");
    } else {
      document.body.classList.remove("compact-mode");
    }
  }, [settings.compactMode]);

  // Apply dark/light theme — sets data-theme on <html> and a class on <body>
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
    }
  }, [settings.darkMode]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isSettingKey }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
