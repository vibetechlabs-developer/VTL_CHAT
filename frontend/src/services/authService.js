import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

export const loginUser = (data) =>
  API.post("/users/login/", data);

export const signupUser = (data) =>
  API.post("/users/signup/", data);

export const refreshToken = (data) =>
  API.post("/users/token/refresh/", data);