import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Auth/Login/Login";
import ForgotPassword from "../pages/Auth/Forgot Password/ForgotPassword";
import ResetPassword from "../pages/Auth/Reset Password/ResetPassword";
import Signup from "../pages/Auth/Signup/Signup";
import Dashboard from "../pages/Dashboard/Dashboard";
import Chat from "../pages/Chat/Chat";
import Meetings from "../pages/Meetings/Meetings";
import MeetingRoom from "../pages/Meetings/MeetingRoom";
import Notifications from "../pages/Notifications/Notifications";
import Profile from "../pages/Profile/Profile";
import Settings from "../pages/Settings/Settings";
import Teams from "../pages/Teams/Teams";
import Channels from "../pages/Channels/Channels";
import ProtectedRoute from "./ProtectedRoute";
import NotFound from "../pages/NotFound/NotFound";

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
          <Route path="/teams" element={<Teams />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/teams/:teamId/channels/:channelId" element={<Chat />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/dm/:channelId" element={<Chat />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:meetingId/room" element={<MeetingRoom />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}


export default AppRoutes;

