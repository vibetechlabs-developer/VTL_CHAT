import { useState } from "react";
import { Bell, Globe, Shield, Palette, Keyboard } from "lucide-react";
import AppLayout from "../../components/vtl/AppLayout";
import GlassCard from "../../components/vtl/GlassCard";
import { useWorkspace } from "../../context/WorkspaceContext";
import "./Settings.scss";

const sections = [
  {
    title: "Appearance",
    icon: Palette,
    settings: [
      { label: "Dark mode", desc: "Always use dark theme", toggle: true, default: true },
      { label: "Compact mode", desc: "Reduce spacing in chat", toggle: true, default: false },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    settings: [
      { label: "Desktop notifications", desc: "Show alerts for mentions and DMs", toggle: true, default: true },
      { label: "Email digest", desc: "Weekly summary of activity", toggle: true, default: false },
      { label: "Meeting reminders", desc: "Notify 15 minutes before meetings", toggle: true, default: true },
    ],
  },
  {
    title: "Privacy & Security",
    icon: Shield,
    settings: [
      { label: "Two-factor authentication", desc: "Add an extra layer of security", toggle: true, default: false },
      { label: "Show online status", desc: "Let others see when you're active", toggle: true, default: true },
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

function Toggle({ defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      className={`settings-toggle ${on ? "settings-toggle--on" : ""}`}
      onClick={() => setOn(!on)}
      role="switch"
      aria-checked={on}
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
                  {s.toggle ? <Toggle defaultOn={s.default} /> : <button className="settings-row__link">Change</button>}
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
