import { useState } from "react";
import AuroraBackground from "./AuroraBackground";
import FloatingSidebar from "./FloatingSidebar";
import ContextSidebar from "./ContextSidebar";
import TopBar from "./TopBar";
import { SkeletonList } from "./Skeleton";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="app-layout app-layout--loading">
        <AuroraBackground />
        <div className="app-layout__loader app-layout__loader--skeleton">
          <SkeletonList count={4} />
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

      {/* Backdrop overlay for mobile menu drawer */}
      {mobileMenuOpen && (
        <div 
          className="app-layout__backdrop" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Column A: Slim Left App Bar */}
      <FloatingSidebar
        onLogout={onLogout}
        initials={initials}
        avatarUrl={profile?.avatar_url}
      />

      {/* Column B: Context-aware Secondary Sidebar */}
      <ContextSidebar 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />

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
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <div className={`app-layout__content ${fullBleed ? "app-layout__content--full" : "app-layout__content--padded"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
