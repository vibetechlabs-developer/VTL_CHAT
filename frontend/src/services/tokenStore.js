let accessToken = null;
const listeners = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
  listeners.forEach((fn) => fn(accessToken));
}

export function clearTokens() {
  accessToken = null;
  listeners.forEach((fn) => fn(null));
}

export function isAuthenticated() {
  return Boolean(accessToken);
}

export function onAccessTokenChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
