"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { api, ApiError, type CourseSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { setPendingImport } from "@/lib/pending-import";

const YOUTUBE_HOSTS = new Set(["youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"]);

// Mirrors backend/src/lib/playlistUrl.ts — this copy is just for instant
// inline feedback (App Flow §2.4 step 2); the backend is the source of truth.
function validatePlaylistUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That doesn't look like a playlist link.";
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return "That doesn't look like a playlist link.";
  if (url.searchParams.get("list")) return null;
  if (url.searchParams.get("v") || host === "youtu.be") {
    return "Please paste a playlist link, not a single video.";
  }
  return "That doesn't look like a playlist link.";
}

type ImportState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "duplicate"; course: CourseSummary };

interface ImportPlaylistFormProps {
  // Landing page (unauthenticated) vs. dashboard (already behind RequireAuth).
  requireAuth?: boolean;
  // "lg" makes this read as the page's dominant call to action (landing hero).
  size?: "md" | "lg";
  // When set, imports into this roadmap (as the next step) instead of as a
  // standalone course — stays on the roadmap page and calls onImported to
  // refetch, rather than navigating into the new course.
  roadmapId?: string;
  onImported?: () => void;
}

export function ImportPlaylistForm({
  requireAuth = false,
  size = "md",
  roadmapId,
  onImported,
}: ImportPlaylistFormProps) {
  const { status: authStatus } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ImportState>({ phase: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setState({ phase: "error", message: "Give your track a name." });
      return;
    }

    const validationError = validatePlaylistUrl(url);
    if (validationError) {
      setState({ phase: "error", message: validationError });
      return;
    }

    if (requireAuth && authStatus !== "authenticated") {
      setPendingImport({ url: url.trim(), title: title.trim() });
      router.push("/login");
      return;
    }

    setState({ phase: "loading" });
    try {
      const res = await api.courses.import(url.trim(), roadmapId, title.trim());
      if (res.status === "duplicate") {
        setState({ phase: "duplicate", course: res.course });
        return;
      }
      if (roadmapId) {
        setTitle("");
        setUrl("");
        setState({ phase: "idle" });
        onImported?.();
        return;
      }
      router.push(`/courses/${res.course.id}`);
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      });
    }
  }

  const isLg = size === "lg";
  const fieldClasses = `rounded-lg border border-line bg-surface text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none ${
    isLg ? "px-4 py-3 text-base" : "px-3.5 py-2.5 text-sm"
  }`;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className={`flex flex-col ${isLg ? "gap-2" : "gap-2.5"}`}>
        <input
          type="text"
          placeholder="Track name…"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (state.phase !== "idle") setState({ phase: "idle" });
          }}
          className={fieldClasses}
        />
        <div className={`flex flex-col sm:flex-row ${isLg ? "gap-2" : "gap-2.5"}`}>
          <input
            type="text"
            placeholder="Paste a YouTube playlist URL…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (state.phase !== "idle") setState({ phase: "idle" });
            }}
            className={`flex-1 ${fieldClasses}`}
          />
          <button
            type="submit"
            disabled={state.phase === "loading" || !title.trim() || !url.trim()}
            className={`shrink-0 rounded-lg bg-accent text-accent-ink shadow-[0_1px_2px_rgba(79,70,229,0.05),0_8px_20px_-6px_rgba(79,70,229,0.45)] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
              isLg ? "px-6 py-3 text-base font-semibold" : "px-4 py-2.5 text-sm font-medium"
            }`}
          >
            {state.phase === "loading" ? "Fetching playlist…" : "Import"}
          </button>
        </div>
      </div>

      {state.phase === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.phase === "duplicate" && (
        <p className="text-sm text-ink-muted">
          You&apos;ve already imported this playlist —{" "}
          <a href={`/courses/${state.course.id}`} className="text-accent underline underline-offset-2">
            go to module
          </a>
          .
        </p>
      )}
    </form>
  );
}
