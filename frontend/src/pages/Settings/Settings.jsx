import { useEffect } from "react";
import { Bell, Globe, Shield, Palette, Keyboard } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSettings } from "../../context/SettingsContext";
import * as workspaceApi from "../../services/workspaceApi";
import { useToast } from "../../context/ToastContext";
import "./Settings.scss";

const sections = [
  {
    title: "Appearance",
    icon: Palette,
    settings: [
      { label: "Dark mode", key: "darkMode", desc: "Switch between dark and light theme", toggle: true },
      { label: "Compact mode", key: "compactMode", desc: "Reduce spacing in chat", toggle: true },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    settings: [
      { label: "Desktop notifications", key: "desktopNotifications", desc: "Show Chrome alerts for mentions and DMs", toggle: true },
      { label: "Email digest", key: "emailDigest", desc: "Weekly summary of activity", toggle: true },
    ],
  },
  {
    title: "Privacy & Security",
    icon: Shield,
    settings: [
      { label: "Two-factor authentication", key: "twoFactorAuth", desc: "Add an extra layer of security", toggle: true },
      { label: "Show online status", key: "showOnlineStatus", desc: "Let others see when you're active", toggle: true },
    ],
  },
];



function Toggle({ checked = false, onChange }) {
  return (
    <button
      className={`settings-toggle ${checked ? "settings-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span />
    </button>
  );
}

export default function Settings() {
  const {
    profile,
    loading,
    error,
    initials,
    handleLogout,
    unreadNotificationCount,
  } = useWorkspace();

  const { settings, updateSetting } = useSettings();
  const toast = useToast();

  useEffect(() => {
    workspaceApi
      .getNotificationPreferences()
      .then((res) => {
        updateSetting("desktopNotifications", res.data.desktop_notifications);
        updateSetting("emailDigest", res.data.email_digest);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncPreference = async (key, value, apiField) => {
    try {
      await workspaceApi.updateNotificationPreferences({ [apiField]: value });
    } catch {
      toast.error("Failed to save preference");
    }
  };

  const handleToggle = (key, value) => {
    if (key === "desktopNotifications" && value === true) {
      if ("Notification" in window) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            updateSetting(key, true);
            syncPreference(key, true, "desktop_notifications");
          } else {
            toast.error("Enable browser notification permission first.");
          }
        });
        return;
      }
    }
    if (key === "emailDigest") {
      updateSetting(key, value);
      syncPreference(key, value, "email_digest");
      return;
    }
    if (key === "desktopNotifications") {
      updateSetting(key, value);
      syncPreference(key, value, "desktop_notifications");
      return;
    }
    if (key === "twoFactorAuth") {
      updateSetting(key, value);
      if (value) {
        alert("Two-factor authentication has been enabled successfully. An authenticator app setup code will be required on your next login.");
      } else {
        alert("Two-factor authentication has been disabled.");
      }
      return;
    }
    if (key) {
      updateSetting(key, value);
    }
  };

  return (
    <AppLayout
      title="Settings"
      subtitle="Customize your workspace experience"
      showSearch={false}
      profile={profile}
      initials={initials}
      onLogout={handleLogout}
      loading={loading}
      error={error}
      unreadNotificationCount={unreadNotificationCount}
    >
      <div className="settings-page">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <GlassCard key={section.title} className="settings-section">
              <div className="settings-section__head">
                <Icon size={18} />
                <h4>{section.title}</h4>
              </div>
              {section.settings.map((s) => (
                <div key={s.label} className="settings-row">
                  <div>
                    <span className="settings-row__label">{s.label}</span>
                    <span className="settings-row__desc">{s.desc}</span>
                  </div>
                  {s.toggle ? (
                    s.key === "twoFactorAuth" ? (
                      <>
                        <Toggle checked={settings[s.key] ?? false} onChange={() => {}} disabled />
                        <span className="badge coming-soon">Coming Soon</span>
                      </>
                    ) : (
                      <Toggle
                        checked={settings[s.key] ?? false}
                        onChange={(val) => handleToggle(s.key, val)}
                      />
                    )
                  ) : (
                    <button className="settings-row__link">Change</button>
                  )}
                </div>
              ))}
            </GlassCard>
          );
        })}

        <GlassCard className="settings-section">
          <div className="settings-section__head">
            <Keyboard size={18} />
            <h4>Keyboard Shortcuts</h4>
          </div>
          <div className="settings-shortcuts">
            <div><kbd>⌘</kbd> + <kbd>K</kbd> <span>Quick search</span></div>
            <div><kbd>⌘</kbd> + <kbd>N</kbd> <span>New message</span></div>
            <div><kbd>⌘</kbd> + <kbd>/</kbd> <span>Toggle sidebar</span></div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
