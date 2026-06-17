import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import StatsCard from "../../components/StatsCard/StatsCard";

import "./Dashboard.scss";

export default function Dashboard() {
  return (
    <div className="dashboard">

      <Sidebar />

      <div className="dashboard-main">

        <Header />

        <div className="stats-container">

          <StatsCard
            title="Teams"
            value="12"
          />

          <StatsCard
            title="Channels"
            value="36"
          />

          <StatsCard
            title="Messages"
            value="8.4K"
          />

          <StatsCard
            title="Meetings"
            value="24"
          />

        </div>

        <div className="dashboard-grid">

          <div className="dashboard-card">
            <h3>Recent Teams</h3>
          </div>

          <div className="dashboard-card">
            <h3>Upcoming Meetings</h3>
          </div>

          <div className="dashboard-card full">
            <h3>Recent Chats</h3>
          </div>

        </div>

      </div>

    </div>
  );
}