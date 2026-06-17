import { Search, Bell, Video, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import "./TopBar.scss";

export default function TopBar({
  title,
  subtitle,
  searchPlaceholder = "Search workspace...",
  searchValue,
  onSearchChange,
  initials,
  username,
  email,
  showSearch = true,
  unreadCount = 0,
}) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__titles">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar__right">
        {showSearch && (
          <div className="topbar__search">
            <Search size={16} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue || ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        )}

        <Link to="/notifications" className="topbar__action" title="Notifications">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="topbar__action-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </Link>

        <Link to="/meetings" className="topbar__action" title="Meetings">
          <Video size={18} />
        </Link>

        <Link to="/profile" className="topbar__profile">
          <div className="topbar__avatar">{initials}</div>
          <div className="topbar__profile-info">
            <span className="topbar__profile-name">{username}</span>
            <span className="topbar__profile-email">{email}</span>
          </div>
          <ChevronDown size={14} className="topbar__profile-chevron" />
        </Link>
      </div>
    </header>
  );
}
