import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Dashboard.scss";

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get("/users/profile/");
        setProfile(response.data);
      } catch (err) {
        setError("Failed to load profile. Redirecting to login...");
        // Clear local storage if token expired/invalid
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh");
      if (refresh) {
        await api.post("/users/logout/", { refresh });
      }
    } catch (err) {
      console.error("Failed to blacklist token in backend:", err);
    } finally {
      // Always clear localStorage and redirect
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="dashboard-card liquid-glass">
            <h2>Loading details...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="dashboard-card liquid-glass">
            <div className="alert-message error">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Get initials for avatar
  const initials = profile?.username
    ? profile.username.substring(0, 2).toUpperCase()
    : "US";

  return (
    <div className="dashboard-page">
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="dashboard-container">
        <div className="dashboard-card liquid-glass">
          <div className="avatar">{initials}</div>
          
          <h1>Welcome, {profile?.username}!</h1>
          <p className="welcome-subtitle">You have successfully logged into VTL CHAT.</p>

          <div className="info-group">
            <div className="info-item">
              <label>Username</label>
              <span>{profile?.username}</span>
            </div>
            
            <div className="info-item">
              <label>Email Address</label>
              <span>{profile?.email}</span>
            </div>
            
            <div className="info-item">
              <label>Account ID</label>
              <span>{profile?.id}</span>
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
