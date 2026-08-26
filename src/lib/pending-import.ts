import { api } from "./api";

// App Flow Document §2.1: a URL pasted on the landing page before login should
// resume automatically once the user signs up/logs in. sessionStorage (not a
// cookie or localStorage) is enough — it only needs to survive the redirect
// to /login or /signup and back.
const KEY = "playlistcourse:pendingImportUrl";

export function setPendingImportUrl(url: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, url);
}

export function takePendingImportUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(KEY);
  if (value) sessionStorage.removeItem(KEY);
  return value;
}

// Call right after a successful login/signup. Resumes a pending import if
// there is one and returns where the caller should navigate next; falls back
// to the dashboard (the user can just retry the import manually there).
export async function resolvePostAuthDestination(): Promise<string> {
  const pendingUrl = takePendingImportUrl();
  if (!pendingUrl) return "/dashboard";

  try {
    const res = await api.courses.import(pendingUrl);
    return `/courses/${res.course.id}`;
  } catch {
    return "/dashboard";
  }
}
