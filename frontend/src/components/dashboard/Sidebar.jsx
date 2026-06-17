import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Video,
  Bell,
  Settings,
  LogOut
} from "lucide-react";

import "./Sidebar.scss";

export default function Sidebar() {

  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        VTL CHAT
      </div>

      <nav>

        <a href="#">
          <LayoutDashboard size={20}/>
          Dashboard
        </a>

        <a href="#">
          <Users size={20}/>
          Teams
        </a>

        <a href="#">
          <MessageSquare size={20}/>
          Chats
        </a>

        <a href="#">
          <Video size={20}/>
          Meetings
        </a>

        <a href="#">
          <Bell size={20}/>
          Notifications
        </a>

        <a href="#">
          <Settings size={20}/>
          Settings
        </a>

      </nav>

      <button className="logout-btn">
        <LogOut size={18}/>
        Logout
      </button>

    </aside>
  );
}