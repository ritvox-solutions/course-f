const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Held in memory only — never localStorage/sessionStorage. Session persistence
// comes from the httpOnly refresh cookie instead (TRD §3).
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function rawRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
}

async function parseErrorMessage(res: Response, path: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `Request to ${path} failed with status ${res.status}`;
}

// A 401 usually just means the access token expired (15 min TTL). Try one
// silent refresh off the httpOnly cookie and retry before giving up — this is
// what lets a session survive across page reloads without re-prompting login.
async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const res = await rawRequest(path, init);

  if (res.status === 401 && allowRefresh && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, false);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res, path));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await rawRequest("/auth/refresh", { method: "POST" });
    if (!res.ok) return false;
    const data = (await res.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export interface HealthResponse {
  status: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface CourseSummary {
  id: string;
  youtubePlaylistId: string;
  title: string;
  description: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  createdAt: string;
  lastSyncedAt: string | null;
  roadmapId: string | null;
  position: number | null;
  locked: boolean;
  lockedBecause: { id: string; title: string } | null;
}

export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface LessonProgress {
  status: LessonStatus;
  lastWatchedSeconds: string;
  watchPercentage: string;
  completedManually: boolean;
}

export interface LessonSummary {
  id: string;
  youtubeVideoId: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  position: number;
  isAvailable: boolean;
  progress: LessonProgress | null;
  note: string | null;
}

export interface CourseDetail extends CourseSummary {
  lessons: LessonSummary[];
}

export type ImportPlaylistResponse =
  | { status: "created"; course: CourseSummary }
  | { status: "duplicate"; course: CourseSummary };

export interface ResyncResponse {
  newLessonsAdded: number;
  totalLessons: number;
  completedLessons: number;
  course: CourseSummary;
}

export interface Roadmap {
  id: string;
  title: string;
  createdAt: string;
}

export interface RoadmapCourseSummary extends CourseSummary {
  locked: boolean;
  position: number;
  totalDurationSeconds: number;
}

export interface RoadmapCourseLessonPreview {
  id: string;
  title: string;
  durationSeconds: number | null;
  isAvailable: boolean;
}

export interface RoadmapCourseDetail extends RoadmapCourseSummary {
  lessons: RoadmapCourseLessonPreview[];
}

export interface RoadmapSummary extends Roadmap {
  courses: RoadmapCourseSummary[];
}

export interface RoadmapDetail extends Roadmap {
  courses: RoadmapCourseDetail[];
}

export interface RoadmapTemplate {
  id: string;
  title: string;
  description: string;
  courseCount: number;
}

export interface UseRoadmapTemplateResponse {
  roadmapId: string;
  results: { status: "created" | "duplicate" | "failed"; message?: string }[];
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  auth: {
    signup: (data: { email: string; password: string; displayName?: string }) =>
      request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST" }, false),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    me: () => request<AuthUser>("/auth/me"),
  },
  courses: {
    list: () => request<CourseSummary[]>("/courses"),
    get: (id: string) => request<CourseDetail>(`/courses/${id}`),
    import: (playlistUrl: string, roadmapId?: string, title?: string) =>
      request<ImportPlaylistResponse>("/courses/import", {
        method: "POST",
        body: JSON.stringify({
          playlistUrl,
          ...(roadmapId ? { roadmapId } : {}),
          ...(title ? { title } : {}),
        }),
      }),
    resync: (id: string) => request<ResyncResponse>(`/courses/${id}/resync`, { method: "POST" }),
    remove: (id: string) => request<void>(`/courses/${id}`, { method: "DELETE" }),
  },
  roadmaps: {
    list: () => request<RoadmapSummary[]>("/roadmaps"),
    get: (id: string) => request<RoadmapDetail>(`/roadmaps/${id}`),
    create: (title: string) =>
      request<RoadmapSummary>("/roadmaps", { method: "POST", body: JSON.stringify({ title }) }),
    remove: (id: string) => request<void>(`/roadmaps/${id}`, { method: "DELETE" }),
  },
  roadmapTemplates: {
    list: () => request<RoadmapTemplate[]>("/roadmap-templates"),
    use: (id: string) =>
      request<UseRoadmapTemplateResponse>(`/roadmap-templates/${id}/use`, { method: "POST" }),
  },
  lessons: {
    saveProgress: (
      lessonId: string,
      data: { lastWatchedSeconds: number; watchPercentage: number },
      opts?: { keepalive?: boolean }
    ) =>
      request<LessonProgress>(`/lessons/${lessonId}/progress`, {
        method: "PATCH",
        body: JSON.stringify(data),
        keepalive: opts?.keepalive,
      }),
    setComplete: (lessonId: string, completed: boolean) =>
      request<LessonProgress>(`/lessons/${lessonId}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      }),
    saveNote: (lessonId: string, content: string) =>
      request<{ content: string | null }>(`/lessons/${lessonId}/notes`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },
};
