/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as workspaceApi from "../services/workspaceApi";
import { clearTokens } from "../services/api";
import logger from "../utils/logger";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    const res = await workspaceApi.getProfile();
    setProfile(res.data);
    return res.data;
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadProfile();
      } catch (err) {
        if (err?.response?.status === 401) {
          clearTokens();
          navigate("/");
          return;
        }
        setError(err?.response?.data?.error || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadProfile, navigate]);

  const handleLogout = async () => {
    try {
      await workspaceApi.logoutUser();
    } catch (err) {
      logger.error("Logout failed:", err);
    } finally {
      clearTokens();
      navigate("/");
    }
  };

  const updateProfile = async (data) => {
    const res = await workspaceApi.updateUser(profile.id, data);
    setProfile(res.data);
    return res.data;
  };

  const updateProfileAvatar = async (file) => {
    const res = await workspaceApi.updateUserAvatar(profile.id, file);
    setProfile(res.data);
    return res.data;
  };

  const initials = profile?.username ? profile.username.substring(0, 2).toUpperCase() : "VT";

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        error,
        initials,
        setProfile,
        loadProfile,
        handleLogout,
        updateProfile,
        updateProfileAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
