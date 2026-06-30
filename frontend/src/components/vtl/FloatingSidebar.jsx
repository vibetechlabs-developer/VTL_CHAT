import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Calendar,
  Bell,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import "./FloatingSidebar.scss";

const navItems = [
  { to: "/notifications", icon: Bell, label: "Activity" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/teams", icon: Users, label: "Teams" },
  { to: "/meetings", icon: Calendar, label: "Calendar" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
];

export default function FloatingSidebar({ onLogout, initials }) {
  return (
    <aside className="floating-sidebar">
      <div className="floating-sidebar__header">
        <div className="floating-sidebar__logo" title="VTL Chat">
          <Sparkles size={20} />
        </div>
      </div>

      <nav className="floating-sidebar__nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `floating-sidebar__link ${isActive ? "floating-sidebar__link--active" : ""}`
            }
            title={label}
          >
            <span className="floating-sidebar__link-icon">
              <Icon size={20} strokeWidth={2} />
            </span>
            <span className="floating-sidebar__link-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="floating-sidebar__footer">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `floating-sidebar__link ${isActive ? "floating-sidebar__link--active" : ""}`
          }
          title="Profile"
        >
          <div className="floating-sidebar__avatar">
            {initials || "U"}
          </div>
          <span className="floating-sidebar__link-label">Profile</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `floating-sidebar__link ${isActive ? "floating-sidebar__link--active" : ""}`
          }
          title="Settings"
        >
          <span className="floating-sidebar__link-icon">
            <Settings size={20} strokeWidth={2} />
          </span>
          <span className="floating-sidebar__link-label">Settings</span>
        </NavLink>

        <button
          className="floating-sidebar__logout-btn"
          onClick={onLogout}
          title="Sign out"
        >
          <LogOut size={20} strokeWidth={2} />
          <span className="floating-sidebar__link-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
