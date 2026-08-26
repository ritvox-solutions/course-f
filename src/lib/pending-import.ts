import { api } from "./api";

// App Flow Document §2.1: a URL (and its user-given track name) pasted on the
// landing page before login should resume automatically once the user signs
// up/logs in. sessionStorage (not a cookie or localStorage) is enough — it
// only needs to survive the redirect to /login or /signup and back.
const KEY = "playlistcourse:pendingImport";

interface PendingImport {
  url: string;
  title: string;
}

export function setPendingImport(pending: PendingImport) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(pending));
}

export function takePendingImport(): PendingImport | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(KEY);
  if (!value) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(value) as PendingImport;
  } catch {
    return null;
  }
}

// Call right after a successful login/signup. Resumes a pending import if
// there is one and returns where the caller should navigate next; falls back
// to the dashboard (the user can just retry the import manually there).
export async function resolvePostAuthDestination(): Promise<string> {
  const pending = takePendingImport();
  if (!pending) return "/dashboard";

  try {
    const res = await api.courses.import(pending.url, undefined, pending.title);
    return `/courses/${res.course.id}`;
  } catch {
    return "/dashboard";
  }
}
