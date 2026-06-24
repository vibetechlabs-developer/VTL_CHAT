import { Navigate, Outlet } from "react-router-dom";
import { WorkspaceProvider } from "../context/WorkspaceContext";

const ProtectedRoute = () => {
  const token = localStorage.getItem("access");

  if (!token) return <Navigate to="/" />;

  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
};

export default ProtectedRoute;
