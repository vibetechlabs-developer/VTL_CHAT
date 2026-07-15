import axios from "axios";
import { setAccessToken, clearTokens } from "./tokenStore";
import { API_BASE_URL } from "./api";

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const loginUser = (data) => API.post("/users/login/", data);

export const signupUser = (data) => API.post("/users/signup/", data);

export const refreshToken = () => API.post("/users/refresh/", {}, { withCredentials: true });

export const forgotPassword = (data) =>
  API.post("/users/forgot-password/", data);

export const resetPassword = (data) =>
  API.post("/users/reset-password/", data);

export const googleLogin = (data) => API.post("/users/google/", data);

export const storeAuthTokens = ({ access }) => {
  if (access) setAccessToken(access);
};

export const clearAuthTokens = () => {
  clearTokens();
};

export const restoreSession = async () => {
  const { data } = await refreshToken();
  setAccessToken(data.access);
  return data.access;
};

export function getLoginErrorMessage(err) {
  if (!err?.response) {
    return "Cannot reach the server. Make sure the backend is running at http://localhost:8000";
  }
  return (
    err.response?.data?.error ||
    err.response?.data?.detail ||
    "Invalid email or password"
  );
}
