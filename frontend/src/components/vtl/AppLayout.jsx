import AuroraBackground from "./AuroraBackground";
import FloatingSidebar from "./FloatingSidebar";
import ContextSidebar from "./ContextSidebar";
import TopBar from "./TopBar";
import "./AppLayout.scss";

export default function AppLayout({
  children,
  title,
  subtitle,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  showSearch = true,
  fullBleed = false,
  profile,
  initials,
  onLogout,
  loading,
  error,
  unreadNotificationCount = 0,
}) {
  if (loading) {
    return (
      <div className="app-layout app-layout--loading">
        <AuroraBackground />
        <div className="app-layout__loader">
          <div className="app-layout__loader-ring" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-layout app-layout--loading">
        <AuroraBackground />
        <div className="app-layout__error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <AuroraBackground />

      {/* Column A: Slim Left App Bar */}
      <FloatingSidebar
        onLogout={onLogout}
        initials={initials}
        avatarUrl={profile?.avatar_url}
      />

      {/* Column B: Context-aware Secondary Sidebar */}
      <ContextSidebar />

      {/* Column C: Main Workspace */}
      <div className="app-layout__main">
        <TopBar
          title={title}
          subtitle={subtitle}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          showSearch={showSearch}
          initials={initials}
          avatarUrl={profile?.avatar_url}
          username={profile?.username}
          email={profile?.email}
          unreadCount={unreadNotificationCount}
          onLogout={onLogout}
        />
        <div className={`app-layout__content ${fullBleed ? "app-layout__content--full" : "app-layout__content--padded"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
