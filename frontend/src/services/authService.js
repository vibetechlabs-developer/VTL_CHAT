import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api",
});

export const loginUser = (data) => API.post("/users/login/", data);

export const signupUser = (data) => API.post("/users/signup/", data);

export const refreshToken = (data) => API.post("/users/refresh/", data);

export const forgotPassword = (data) =>
  API.post("/users/forgot-password/", data);

export const resetPassword = (data) =>
  API.post("/users/reset-password/", data);

export const googleLogin = (data) => API.post("/users/google/", data);

export const storeAuthTokens = ({ access, refresh }) => {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
};
