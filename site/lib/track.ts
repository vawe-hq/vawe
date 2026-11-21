import type { ActionName } from "./bots";

// No cookie and no storage: the referrer of the page the visitor loaded carries the source.
export function track(action: ActionName): void {
  try {
    navigator.sendBeacon("/api/event", JSON.stringify({ a: action, p: location.pathname, r: document.referrer }));
  } catch {
    // a browser without sendBeacon sends nothing
  }
}
