import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AuroraBackground from "./AuroraBackground";
import FloatingSidebar from "./FloatingSidebar";
import ContextSidebar from "./ContextSidebar";
import TopBar from "./TopBar";
import { SkeletonList } from "./Skeleton";
import { useIsMobile } from "../../hooks/useMediaQuery";
import "./AppLayout.scss";

function isMobileDetailRoute(pathname) {
  return (
    /\/chat\/dm\/\d+/.test(pathname) ||
    /\/teams\/\d+\/channels\/\d+/.test(pathname)
  );
}

function getBackTarget(pathname) {
  if (pathname.startsWith("/chat/dm/")) return "/chat";
  if (pathname.includes("/teams/") && pathname.includes("/channels/")) return "/teams";
  return null;
}

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
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  const isDetailView = isMobile && isMobileDetailRoute(location.pathname);
  const backTarget = getBackTarget(location.pathname);

  const backButton = useMemo(() => {
    if (!isDetailView || !backTarget) return null;
    return (
      <button
        type="button"
        className="topbar__back-btn"
        onClick={() => navigate(backTarget)}
        aria-label="Back to list"
      >
        <ArrowLeft size={20} />
      </button>
    );
  }, [isDetailView, backTarget, navigate]);

  const layoutClass = [
    "app-layout",
    isMobile ? "app-layout--mobile" : "",
    isDetailView ? "app-layout--detail" : "",
    fullBleed ? "app-layout--full-bleed" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
    <div className={layoutClass}>
      <AuroraBackground />

      {mobileMenuOpen && (
        <div
          className="app-layout__backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <FloatingSidebar
        onLogout={onLogout}
        initials={initials}
        avatarUrl={profile?.avatar_url}
      />

      <ContextSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isMobile={isMobile}
      />

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
          backButton={backButton}
          showMenuButton={isMobile && !isDetailView}
        />
        <div
          className={`app-layout__content ${
            fullBleed ? "app-layout__content--full" : "app-layout__content--padded"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
