import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Auth/Login/Login";
import ForgotPassword from "../pages/Auth/Forgot Password/ForgotPassword";
import ResetPassword from "../pages/Auth/Reset Password/ResetPassword";
import Signup from "../pages/Auth/Signup/Signup";
import Dashboard from "../pages/Dashboard/Dashboard";
import Teams from "../pages/Teams/Teams";
import Channels from "../pages/Channels/Channels";
import Chat from "../pages/Chat/Chat";
import Meetings from "../pages/Meetings/Meetings";
import Notifications from "../pages/Notifications/Notifications";
import Profile from "../pages/Profile/Profile";
import Settings from "../pages/Settings/Settings";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
        <Route path="/channels" element={<ProtectedRoute><Channels /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
