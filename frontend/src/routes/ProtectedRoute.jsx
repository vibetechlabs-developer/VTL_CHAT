import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { WorkspaceProvider } from "../context/WorkspaceContext";
import { getAccessToken } from "../services/api";
import { restoreSession } from "../services/authService";
import { SkeletonList } from "../components/vtl/Skeleton";

const ProtectedRoute = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(Boolean(getAccessToken()));

  useEffect(() => {
    const init = async () => {
      if (getAccessToken()) {
        setAuthenticated(true);
        setAuthChecked(true);
        return;
      }
      try {
        await restoreSession();
        setAuthenticated(true);
      } catch {
        setAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    init();
  }, []);

  if (!authChecked) {
    return (
      <div className="app-layout app-layout--loading" style={{ padding: "2rem" }}>
        <SkeletonList count={3} />
      </div>
    );
  }

  if (!authenticated) return <Navigate to="/" />;

  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
};

export default ProtectedRoute;
