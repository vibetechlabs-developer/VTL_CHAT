import { Navigate } from "react-router-dom";
import { WorkspaceProvider } from "../context/WorkspaceContext";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("access");

  if (!token) return <Navigate to="/" />;

  return <WorkspaceProvider>{children}</WorkspaceProvider>;
};

export default ProtectedRoute;
