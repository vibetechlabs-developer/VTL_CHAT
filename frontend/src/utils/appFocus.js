/**
 * App focus / visibility helpers for desktop notification delivery.
 *
 * Behavior matrix:
 * | State              | In-app UI | OS/browser Notification |
 * |--------------------|-----------|-------------------------|
 * | open + focused     | yes       | no (avoid duplicate)    |
 * | open + background  | no        | yes                     |
 * | closed             | n/a       | n/a*                    |
 *
 * *The Notification API requires an open browser context. True push when the
 * tab is fully closed needs a service worker / push subscription (not yet implemented).
 */

export function isAppFocused() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

/** Show OS-level notification only when the user is not actively viewing the app. */
export function shouldShowDesktopNotification() {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  return !document.hasFocus();
}
