"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type CourseDetail, type LessonSummary } from "@/lib/api";
import { RequireAuth } from "@/lib/require-auth";
import { AppHeader } from "@/components/app-header";
import { LessonStatusIcon } from "@/components/lesson-status-icon";
import { ProgressBar } from "@/components/progress-bar";
import { YouTubePlayer } from "@/components/youtube-player";
import { Skeleton } from "@/components/skeleton";

// YouTube's documented, stable numeric player states (event.data on
// onStateChange). Hardcoded rather than threaded through from the loaded API
// object just to read an enum.
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;
const SEEK_STEP_SECONDS = 10;
const TOGGLE_DEBOUNCE_MS = 350;

const SAVE_INTERVAL_MS = 7000; // App Flow §2.6: "every 5-10s"
const NOTES_DEBOUNCE_MS = 900;
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const PLAYBACK_RATE_STORAGE_KEY = "syllabus:playbackRate";

type WatchProgress = { lastWatchedSeconds: number; watchPercentage: number };

type State =
  | { phase: "loading" }
  | { phase: "redirecting" }
  | { phase: "error"; message: string }
  | { phase: "ready"; course: CourseDetail };

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findNeighbors(lessons: LessonSummary[], lessonId: string) {
  const available = lessons.filter((l) => l.isAvailable);
  const index = available.findIndex((l) => l.id === lessonId);
  return {
    prev: index > 0 ? available[index - 1] : null,
    next: index >= 0 && index < available.length - 1 ? available[index + 1] : null,
  };
}

// Minimal in-app controls that replace YouTube's native chrome (see
// youtube-player.tsx: controls=0) — no branded pause cards, suggested
// videos, or "Watch on YouTube" prompts.
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function VolumeIcon({ className, muted }: { className?: string; muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" />
      {muted ? <path d="M16.5 9.5l4 4m0-4l-4 4" /> : <path d="M16.3 8.3a5 5 0 0 1 0 7.4M18.8 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

function CaptionsIcon({ className, active }: { className?: string; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="13"
        rx="2.5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <text
        x="12"
        y="15.3"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill={active ? "var(--video-bg)" : "currentColor"}
      >
        CC
      </text>
    </svg>
  );
}

function FullscreenIcon({ className, active }: { className?: string; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {active ? (
        <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20M9 20v-3.5A1.5 1.5 0 0 0 7.5 15H4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20" />
      ) : (
        <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      )}
    </svg>
  );
}

function SidebarLessonRow({
  courseId,
  lesson,
  active,
}: {
  courseId: string;
  lesson: LessonSummary;
  active: boolean;
}) {
  const status = lesson.progress?.status ?? "not_started";

  const content = (
    <>
      <LessonStatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${active ? "font-medium text-accent" : "text-ink"}`}>{lesson.title}</p>
        <p className="text-xs text-ink-muted">
          {formatDuration(lesson.durationSeconds)}
          {!lesson.isAvailable && <span className="ml-1.5">· Unavailable</span>}
        </p>
      </div>
    </>
  );

  if (!lesson.isAvailable) {
    return <div className="flex cursor-not-allowed items-center gap-2.5 px-3 py-2.5 opacity-50">{content}</div>;
  }

  return (
    <Link
      href={`/courses/${courseId}/lessons/${lesson.id}`}
      className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-surface-muted"
      }`}
    >
      {content}
    </Link>
  );
}

function LessonPlayerSkeleton() {
  return (
    <div className="flex w-full max-w-[1600px] flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="w-full shrink-0 space-y-2 lg:w-80">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function LessonPlayerContent({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [toggling, setToggling] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  const playerRef = useRef<YT.Player | null>(null);
  const lastToggleAtRef = useRef(0);
  const lastProgressRef = useRef<WatchProgress | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.courses
      .get(courseId)
      .then((course) => {
        if (cancelled) return;
        // A locked roadmap course (direct URL, stale link, back-button —
        // the UI never links here for a locked course) bounces to the
        // course page, which renders the locked banner. The real
        // enforcement is server-side (progress/complete/notes all 403 for
        // a locked lesson); this is just the legitimate-user UX path.
        if (course.locked) {
          setState({ phase: "redirecting" });
          router.replace(`/courses/${courseId}`);
          return;
        }
        // A courseId you own paired with a lessonId that isn't in it (wrong
        // course, typo, stale link) gets the same "bounce, don't dead-end"
        // treatment as a 404 (App Flow §3).
        const lesson = course.lessons.find((l) => l.id === lessonId);
        if (!lesson) {
          setState({ phase: "redirecting" });
          router.replace("/dashboard");
          return;
        }
        setState({ phase: "ready", course });
        setNoteContent(lesson.note ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        // App Flow §3: navigating directly to a course/lesson you don't own
        // bounces you to the Dashboard rather than showing an error.
        if (err instanceof ApiError && err.status === 404) {
          setState({ phase: "redirecting" });
          router.replace("/dashboard");
          return;
        }
        setState({
          phase: "error",
          message: err instanceof ApiError ? err.message : "Could not load this lesson.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, router]);

  // Reads live from the player when it's still alive. On final unmount
  // (navigating to another lesson) the player is already destroyed by then —
  // React cleans up child effects before parent ones — so persistProgress
  // falls back to the last value this captured instead of touching the
  // dead player.
  const captureProgress = useCallback((): WatchProgress | null => {
    const player = playerRef.current;
    if (!player) return null;
    try {
      const duration = player.getDuration();
      const currentTime = player.getCurrentTime();
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return null;
      const progress: WatchProgress = {
        lastWatchedSeconds: currentTime,
        watchPercentage: Math.min(100, (currentTime / duration) * 100),
      };
      lastProgressRef.current = progress;
      return progress;
    } catch {
      return null;
    }
  }, []);

  const persistProgress = useCallback(
    (progress: WatchProgress | null, opts?: { keepalive?: boolean }) => {
      const toSend = progress ?? lastProgressRef.current;
      if (!toSend) return;
      api.lessons.saveProgress(lessonId, toSend, opts).catch(() => {});
    },
    [lessonId]
  );

  const stopInterval = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    saveIntervalRef.current = setInterval(() => persistProgress(captureProgress()), SAVE_INTERVAL_MS);
  }, [captureProgress, persistProgress, stopInterval]);

  // Tab close / switch-away: the player is still alive here (this is a
  // visibility change, not an unmount), so a fresh read is safe. keepalive
  // lets the request survive the page actually unloading.
  useEffect(() => {
    function handleUnload() {
      persistProgress(captureProgress(), { keepalive: true });
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        persistProgress(captureProgress(), { keepalive: true });
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      stopInterval();
      if (uiIntervalRef.current) clearInterval(uiIntervalRef.current);
      persistProgress(null, { keepalive: true });
    };
  }, [captureProgress, persistProgress, stopInterval]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === videoWrapperRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Space/←/→ control the player — skipped while typing (notes textarea,
  // any input) so the shortcuts don't hijack normal text editing.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (!playerRef.current) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekBy(SEEK_STEP_SECONDS);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekBy(-SEEK_STEP_SECONDS);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Runs once on mount to pick up the viewer's last-chosen speed — a fresh
  // player always starts at 1x, so this is re-applied in handlePlayerReady.
  useEffect(() => {
    const raw = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    // Syncing one-time from an external store (localStorage) on mount, not
    // reacting to React state — the sanctioned exception to this rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (PLAYBACK_RATES.includes(parsed)) setPlaybackRate(parsed);
  }, []);

  // getOption/loadModule/unloadModule aren't part of @types/youtube's Player
  // interface (an older, undocumented-by-Google corner of the IFrame API).
  type PlayerWithCaptions = YT.Player & {
    loadModule: (module: string) => void;
    unloadModule: (module: string) => void;
    getOption: (module: string, option: string) => unknown;
  };

  // Ground truth for "are captions actually showing on this video" — not
  // every video has a caption track, and loadModule("captions") silently
  // no-ops when one isn't available, so the button's state has to come from
  // asking the player rather than assuming the toggle it was sent worked.
  function readCaptionsOn(player: PlayerWithCaptions): boolean {
    try {
      const track = player.getOption("captions", "track") as { languageCode?: string } | undefined;
      return !!track?.languageCode;
    } catch {
      return false;
    }
  }

  // Polls the real player rather than trusting our own optimistic state —
  // matches the existing captureProgress pattern of reading ground truth.
  function updatePlayerUiState() {
    const player = playerRef.current as PlayerWithCaptions | null;
    if (!player) return;
    try {
      setCurrentTime(player.getCurrentTime());
      const d = player.getDuration();
      if (Number.isFinite(d) && d > 0) setDuration(d);
      const playerState = player.getPlayerState();
      setIsPlaying(playerState === YT_STATE.PLAYING || playerState === YT_STATE.BUFFERING);
      setIsMuted(player.isMuted());
      setCaptionsOn(readCaptionsOn(player));
    } catch {
      // Player torn down mid-tick (lesson navigation) — next tick or the
      // interval cleanup in the unmount effect will resolve this.
    }
  }

  function handlePlayerReady(player: YT.Player) {
    playerRef.current = player;
    player.setPlaybackRate(playbackRate);
    updatePlayerUiState();
    if (uiIntervalRef.current) clearInterval(uiIntervalRef.current);
    uiIntervalRef.current = setInterval(updatePlayerUiState, 300);
  }

  function handleRateChange(rate: number) {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate(rate);
    window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
  }

  // Reads the player's real, current state rather than the polled `isPlaying`
  // — that state can lag behind (poll interval), so trusting it here let a
  // fast double-click send playVideo() twice in a row. The debounce below
  // covers the remaining gap: even getPlayerState() has postMessage latency
  // to the iframe, so clicks faster than that round-trip could still flood
  // it with conflicting commands and leave the real player stuck.
  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    const now = Date.now();
    if (now - lastToggleAtRef.current < TOGGLE_DEBOUNCE_MS) return;

    const playerState = player.getPlayerState();
    // BUFFERING is transient (mid-seek — including the ±10s shortcut —
    // or a slow initial load). Calling pauseVideo() while buffering is a
    // known YouTube IFrame API foot-gun: it can leave the player stuck,
    // ignoring every playVideo()/pauseVideo() call after. Ignoring the
    // press here (and not spending the debounce window on it) means a
    // repeat press once buffering resolves to PLAYING/PAUSED works
    // normally instead of the player wedging.
    if (playerState === YT_STATE.BUFFERING) return;

    lastToggleAtRef.current = now;
    if (playerState === YT_STATE.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function seekBy(deltaSeconds: number) {
    const player = playerRef.current;
    if (!player) return;
    const duration = player.getDuration();
    const target = player.getCurrentTime() + deltaSeconds;
    const clamped = Number.isFinite(duration) && duration > 0 ? Math.min(duration, Math.max(0, target)) : Math.max(0, target);
    player.seekTo(clamped, true);
    setCurrentTime(clamped);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoWrapperRef.current?.requestFullscreen();
    }
  }

  // loadModule/unloadModule aren't part of @types/youtube's Player interface
  // (an older, undocumented-by-Google corner of the IFrame API), but they're
  // the standard way to toggle captions on/off without needing to know which
  // languages/tracks a given video actually has.
  function toggleCaptions() {
    const player = playerRef.current as PlayerWithCaptions | null;
    if (!player) return;
    if (readCaptionsOn(player)) {
      player.unloadModule("captions");
    } else {
      player.loadModule("captions");
    }
    // No optimistic setCaptionsOn here — the next poll tick reads the
    // player's real track state, so if this video has no captions to load,
    // the button honestly reports "off" instead of claiming success.
  }

  function seekToClientX(clientX: number) {
    const bar = scrubRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    playerRef.current?.seekTo(time, true);
    setCurrentTime(time);
  }

  function handleScrubPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  }

  function handleScrubPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    seekToClientX(e.clientX);
  }

  function handleStateChange(event: YT.OnStateChangeEvent) {
    if (event.data === YT_STATE.PLAYING) {
      setEnded(false);
      startInterval();
      return;
    }

    stopInterval();

    if (event.data === YT_STATE.PAUSED) {
      persistProgress(captureProgress());
    }

    if (event.data === YT_STATE.ENDED) {
      persistProgress(captureProgress());
      setEnded(true);
    }
  }

  async function toggleComplete(lesson: LessonSummary) {
    setToggling(true);
    try {
      await api.lessons.setComplete(lessonId, lesson.progress?.status !== "completed");
      const refreshed = await api.courses.get(courseId);
      setState({ phase: "ready", course: refreshed });
    } finally {
      setToggling(false);
    }
  }

  function handleNoteChange(value: string) {
    setNoteContent(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      api.lessons.saveNote(lessonId, value).catch(() => {});
    }, NOTES_DEBOUNCE_MS);
  }

  function flushNoteSave() {
    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    api.lessons.saveNote(lessonId, noteContent).catch(() => {});
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 flex-col bg-canvas">
        <AppHeader backHref={`/courses/${courseId}`} backLabel="Module" />
        <div className="flex flex-1 flex-col items-center px-4 py-8">
          <LessonPlayerSkeleton />
        </div>
      </div>
    );
  }

  if (state.phase === "redirecting") {
    return null;
  }

  if (state.phase === "error") {
    return <p className="flex-1 py-24 text-center text-danger">{state.message}</p>;
  }

  const { course } = state;
  // Guaranteed present: the loading effect already redirected away if not.
  const lesson = course.lessons.find((l) => l.id === lessonId)!;

  const { prev: prevLesson, next: nextLesson } = findNeighbors(course.lessons, lessonId);
  const status = lesson.progress?.status ?? "not_started";
  const isCompleted = status === "completed";
  const startSeconds = lesson.progress ? Number(lesson.progress.lastWatchedSeconds) : 0;

  function goToLesson(target: LessonSummary | null) {
    if (!target) return;
    router.push(`/courses/${course.id}/lessons/${target.id}`);
  }

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <AppHeader backHref={`/courses/${course.id}`} backLabel={course.title} />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-4 py-8 lg:flex-row lg:items-start lg:px-6">
        <div className="min-w-0 flex-1 space-y-5">
          <div
            ref={videoWrapperRef}
            className="relative aspect-video w-full overflow-hidden rounded-2xl bg-video-bg shadow-[0_30px_80px_-25px_rgba(79,70,229,0.35),0_15px_40px_-15px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
          >
            <YouTubePlayer
              videoId={lesson.youtubeVideoId}
              startSeconds={startSeconds}
              onReady={handlePlayerReady}
              onStateChange={handleStateChange}
            />

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="absolute inset-0 h-full w-full cursor-pointer"
            />

            {!isPlaying && !ended && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play"
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_8px_30px_-6px_rgba(79,70,229,0.65)] transition-transform hover:scale-105"
              >
                <PlayIcon className="h-6 w-6 translate-x-0.5" />
              </button>
            )}

            {!ended && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8 backdrop-blur-[2px]">
                <div
                  ref={scrubRef}
                  onPointerDown={handleScrubPointerDown}
                  onPointerMove={handleScrubPointerMove}
                  className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/25"
                >
                  <div
                    className="pointer-events-none h-full rounded-full bg-accent"
                    style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-white">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-7 w-7 items-center justify-center"
                  >
                    {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    className="flex h-7 w-7 items-center justify-center"
                  >
                    <VolumeIcon className="h-4 w-4" muted={isMuted} />
                  </button>
                  <span className="text-xs tabular-nums text-white/80">
                    {formatDuration(currentTime)} / {formatDuration(duration)}
                  </span>
                  <button
                    type="button"
                    onClick={toggleCaptions}
                    aria-label={captionsOn ? "Turn off captions" : "Turn on captions"}
                    aria-pressed={captionsOn}
                    className="ml-auto flex h-7 w-7 items-center justify-center text-white"
                  >
                    <CaptionsIcon className="h-4 w-4" active={captionsOn} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    className="flex h-7 w-7 items-center justify-center"
                  >
                    <FullscreenIcon className="h-4 w-4" active={isFullscreen} />
                  </button>
                </div>
              </div>
            )}

            {ended && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-overlay px-6 text-center">
                <p className="font-display text-xl font-medium text-canvas">Lesson complete!</p>
                {nextLesson ? (
                  <>
                    <p className="text-sm text-canvas/70">Next: {nextLesson.title}</p>
                    <button
                      type="button"
                      onClick={() => goToLesson(nextLesson)}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                    >
                      Next Lesson
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-canvas/70">You&apos;ve finished the module.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">Speed</span>
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleRateChange(rate)}
                aria-pressed={playbackRate === rate}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  playbackRate === rate
                    ? "bg-accent text-accent-ink"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Lesson {lesson.position + 1} of {course.lessons.length}
            </p>
            <div className="flex items-start justify-between gap-3 pt-1">
              <div>
                <h1 className="text-balance font-display text-2xl font-medium tracking-tight text-ink">
                  {lesson.title}
                </h1>
                <p className="mt-1 text-sm text-ink-muted">{formatDuration(lesson.durationSeconds)}</p>
              </div>
              <LessonStatusIcon status={status} />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={isCompleted}
              disabled={toggling}
              onChange={() => toggleComplete(lesson)}
              className="h-4 w-4 accent-accent"
            />
            Mark complete
          </label>

          <div className="rounded-xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-ink"
            >
              Notes
              <span className="text-ink-muted" aria-hidden>
                {notesOpen ? "−" : "+"}
              </span>
            </button>
            {notesOpen && (
              <textarea
                value={noteContent}
                onChange={(e) => handleNoteChange(e.target.value)}
                onBlur={flushNoteSave}
                placeholder="Notes for this lesson…"
                rows={4}
                className="w-full resize-none border-t border-line bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line pt-5">
            <button
              type="button"
              disabled={!prevLesson}
              onClick={() => goToLesson(prevLesson)}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Previous Lesson
            </button>
            <button
              type="button"
              disabled={!nextLesson}
              onClick={() => goToLesson(nextLesson)}
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next Lesson
            </button>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-20 lg:w-80">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="line-clamp-2 font-display text-base font-medium text-ink">{course.title}</h2>
            <div className="mt-3 space-y-1.5">
              <ProgressBar completed={course.completedLessons} total={course.totalLessons} />
              <p className="text-xs text-ink-muted">
                {course.completedLessons} of {course.totalLessons} lessons complete
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {course.lessons.map((l) => (
                <li key={l.id}>
                  <SidebarLessonRow courseId={course.id} lesson={l} active={l.id === lessonId} />
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LessonPlayerPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const lessonId = Array.isArray(params.lessonId) ? params.lessonId[0] : params.lessonId;

  return (
    <RequireAuth>
      <LessonPlayerContent key={lessonId} courseId={id} lessonId={lessonId} />
    </RequireAuth>
  );
}
