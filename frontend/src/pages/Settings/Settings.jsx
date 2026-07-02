import { Bell, Globe, Shield, Palette, Keyboard } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSettings } from "../../context/SettingsContext";
import "./Settings.scss";

const sections = [
  {
    title: "Appearance",
    icon: Palette,
    settings: [
      { label: "Dark mode", key: "darkMode", desc: "Always use dark theme", toggle: true },
      { label: "Compact mode", key: "compactMode", desc: "Reduce spacing in chat", toggle: true },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    settings: [
      { label: "Desktop notifications", key: "desktopNotifications", desc: "Show alerts for mentions and DMs", toggle: true },
      { label: "Email digest", key: "emailDigest", desc: "Weekly summary of activity", toggle: true },
    ],
  },
  {
    title: "Privacy & Security",
    icon: Shield,
    settings: [
      { label: "Two-factor authentication", desc: "Add an extra layer of security", toggle: true },
      { label: "Show online status", desc: "Let others see when you're active", toggle: true },
    ],
  },
  {
    title: "Language & Region",
    icon: Globe,
    settings: [
      { label: "Language", desc: "English (US)", toggle: false },
      { label: "Timezone", desc: "Pacific Time (PT)", toggle: false },
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

  const handleToggle = (key, value) => {
    if (key === "desktopNotifications" && value === true) {
      if ("Notification" in window) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            updateSetting(key, true);
          } else {
            alert("Please allow notification permissions in your browser to enable this feature.");
          }
        });
        return;
      }
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
                    <Toggle 
                      checked={s.key ? settings[s.key] : false} 
                      onChange={(val) => s.key ? handleToggle(s.key, val) : null} 
                    />
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
