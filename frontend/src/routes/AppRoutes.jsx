import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Auth/Login/Login";
import ForgotPassword from "../pages/Auth/Forgot Password/ForgotPassword";
import ResetPassword from "../pages/Auth/Reset Password/ResetPassword";
import Signup from "../pages/Auth/Signup/Signup";
import Dashboard from "../pages/Dashboard/Dashboard";
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
        
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/teams" element={<Chat />} />
          <Route path="/teams/:teamId/channels/:channelId" element={<Chat />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/dm/:channelId" element={<Chat />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


export default AppRoutes;

