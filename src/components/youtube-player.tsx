"use client";

import { useEffect, useRef } from "react";
import { loadYouTubeIframeApi } from "@/lib/youtube-iframe-api";

interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  onReady: (player: YT.Player) => void;
  onStateChange: (event: YT.OnStateChangeEvent) => void;
}

// App Flow §2.6 / UI-UX Brief §3.3: the app's own player, not a link out to
// youtube.com — rel=0 + modestbranding=1 reduce (not eliminate — see PRD §7)
// related-video suggestions and branding.
export function YouTubePlayer({ videoId, startSeconds = 0, onReady, onStateChange }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the latest callbacks in refs so the effect below doesn't need them
  // as dependencies — the player is created once per videoId and should
  // always call whatever the current handlers are, not stale ones.
  const onReadyRef = useRef(onReady);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onReadyRef.current = onReady;
    onStateChangeRef.current = onStateChange;
  });

  useEffect(() => {
    let cancelled = false;
    let player: YT.Player | null = null;

    loadYouTubeIframeApi().then((YTApi) => {
      if (cancelled || !containerRef.current) return;

      player = new YTApi.Player(containerRef.current, {
        videoId,
        // The privacy-enhanced domain also drops some of the overlay
        // "suggested video" cards the standard youtube.com embed shows.
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          // Native controls carry YouTube's own pause-card branding, "Watch
          // on YouTube" prompts, and suggested videos — none of which are
          // suppressible via embed params. Owning controls entirely (a
          // custom bar driven by the JS API in the lesson player) is the
          // only reliable way to keep this fully in-app.
          controls: 0,
          disablekb: 1,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (startSeconds > 0) event.target.seekTo(startSeconds, true);
            onReadyRef.current(event.target);
          },
          onStateChange: (event) => onStateChangeRef.current(event),
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
    // startSeconds intentionally excluded — it should only apply on the
    // initial seek when the player for this videoId is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
