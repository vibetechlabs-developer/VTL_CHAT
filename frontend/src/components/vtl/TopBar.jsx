import { useState, useRef, useEffect } from "react";
import { Search, Bell, Video, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext";
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
  onLogout,
}) {
  const { settings } = useSettings();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

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

        <div className="topbar__profile-wrapper" ref={dropdownRef}>
          <button 
            className="topbar__profile" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="topbar__avatar">
              {initials}
              {settings.showOnlineStatus && <span className="topbar__avatar-status topbar__avatar-status--online" />}
            </div>
            <div className="topbar__profile-info">
              <span className="topbar__profile-name">{username}</span>
              <span className="topbar__profile-email">{email}</span>
            </div>
            <ChevronDown size={14} className="topbar__profile-chevron" />
          </button>
          
          {dropdownOpen && (
            <div className="topbar__dropdown">
              <Link to="/profile" className="topbar__dropdown-item" onClick={() => setDropdownOpen(false)}>
                <User size={16} /> Profile
              </Link>
              <Link to="/settings" className="topbar__dropdown-item" onClick={() => setDropdownOpen(false)}>
                <Settings size={16} /> Settings
              </Link>
              <div className="topbar__dropdown-divider"></div>
              <button className="topbar__dropdown-item topbar__dropdown-item--danger" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
