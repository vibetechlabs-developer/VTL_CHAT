import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Hash,
  MessageSquare,
  Video,
  Bell,
  User,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import "./FloatingSidebar.scss";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/teams", icon: Users, label: "Teams" },
  { to: "/channels", icon: Hash, label: "Channels" },
  { to: "/chat", icon: MessageSquare, label: "Chat", featured: true },
  { to: "/meetings", icon: Video, label: "Meetings" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/profile", icon: User, label: "Profile" },
  { to: "/settings", icon: Settings, label: "Settings" },
];
export default function FloatingSidebar({ collapsed, onToggle, onLogout }) {
  return (
    <aside className={`floating-sidebar ${collapsed ? "floating-sidebar--collapsed" : ""}`}>
      <div className="floating-sidebar__header">
        <div className="floating-sidebar__brand">
          <div className="floating-sidebar__logo">
            <Sparkles size={18} />
          </div>
          {!collapsed && <span className="floating-sidebar__name">VTL Chat</span>}
        </div>
      </div>

      <nav className="floating-sidebar__nav">
        {navItems.map(({ to, icon: Icon, label, featured }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `floating-sidebar__link ${isActive ? "floating-sidebar__link--active" : ""} ${
                featured ? "floating-sidebar__link--featured" : ""
              }`
            }
            title={label}
          >
            <span className="floating-sidebar__link-icon">
              <Icon size={18} strokeWidth={1.75} />
            </span>
            {!collapsed && <span className="floating-sidebar__link-label">{label}</span>}
            {featured && !collapsed && <span className="floating-sidebar__link-badge">Live</span>}
          </NavLink>
        ))}
      </nav>

      <div className="floating-sidebar__footer">
        <button
          className="floating-sidebar__logout"
          onClick={onLogout}
          title="Sign out"
        >
          <LogOut size={18} strokeWidth={1.75} />
          {!collapsed && <span>Sign out</span>}
        </button>

        {!collapsed && (
          <button className="floating-sidebar__collapse" onClick={onToggle}>
            Collapse
          </button>
        )}
        {collapsed && (
          <button className="floating-sidebar__collapse floating-sidebar__collapse--icon" onClick={onToggle} title="Expand">
            →
          </button>
        )}
      </div>
    </aside>
  );
}
