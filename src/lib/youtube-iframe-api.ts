let apiPromise: Promise<typeof YT> | null = null;

// Loads https://www.youtube.com/iframe_api once per page and resolves when
// window.YT is ready. Safe to call from multiple components — subsequent
// calls just await the same in-flight (or already-resolved) promise.
export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadYouTubeIframeApi can only run in the browser"));
  }

  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });

  return apiPromise;
}
