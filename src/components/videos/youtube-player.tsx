"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, RotateCcw } from "lucide-react";

type PlayerState = "idle" | "playing" | "paused" | "ended";

const noop = () => () => {};
/** The page's origin on the client (YouTube posts player events back to it); null on the server. */
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => null);

/**
 * A YouTube video without the way back into YouTube: the privacy-enhanced embed with suggestions
 * limited, and our own cover over the player while it is paused (where YouTube shows "More
 * videos") and when it ends (where it shows the end-screen grid). The cover leaves the bottom
 * control bar free so the student can still seek. Player state comes from YouTube's postMessage
 * events, the same channel its IFrame API uses.
 */
export function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const origin = useOrigin();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<PlayerState>("idle");

  useEffect(() => {
    let heard = false;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; info?: unknown };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      heard = true;
      const info = data?.info as { playerState?: number } | number | undefined;
      const code = data?.event === "onStateChange" ? info : data?.event === "infoDelivery" && typeof info === "object" ? info?.playerState : undefined;
      if (code === 1 || code === 3) setState("playing");
      else if (code === 2) setState("paused");
      else if (code === 0) setState("ended");
    };
    window.addEventListener("message", onMessage);
    // Ask the player to report its state; repeat until it answers (it may not be ready on load).
    const hello = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId, channel: "widget" }), "*");
    let tries = 0;
    const timer = window.setInterval(() => { if (heard || ++tries > 20) window.clearInterval(timer); else hello(); }, 500);
    return () => { window.removeEventListener("message", onMessage); window.clearInterval(timer); };
  }, [videoId, origin]);

  const command = (func: string, args: unknown[] = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  const params = new URLSearchParams({ enablejsapi: "1", rel: "0", playsinline: "1", iv_load_policy: "3", modestbranding: "1", ...(origin ? { origin } : {}) });
  return <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
    {origin ? <iframe
      ref={frame}
      src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className="absolute inset-0 size-full"
    /> : null}

    {/* The title bar links out to YouTube; a clear strip over it keeps taps inside the app. */}
    <div aria-hidden className="absolute inset-x-0 top-0 h-14" />

    {state === "paused" ? <button type="button" onClick={() => command("playVideo")} className="absolute inset-x-0 top-0 bottom-12 flex flex-col items-center justify-center gap-2 bg-slate-950/70 text-white backdrop-blur-sm">
      <span className="flex size-16 items-center justify-center rounded-full bg-white/95 text-blue-700 shadow-lg"><Play className="size-7 translate-x-0.5 fill-current" /></span>
      <span className="text-sm font-semibold">চালিয়ে যান</span>
    </button> : null}

    {state === "ended" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-[#3f6ef3] to-[#8fa6fb] p-4 text-center text-white">
      <p className="text-lg font-bold">ভিডিও শেষ 🎉</p>
      <p className="max-w-xs text-sm text-white/90">যা শিখলেন, নোট করে রাখুন — না হলে ভুলে যাবেন।</p>
      <button type="button" onClick={() => { command("seekTo", [0, true]); command("playVideo"); }} className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm active:scale-95"><RotateCcw className="size-4" /> আবার দেখুন</button>
    </div> : null}
  </div>;
}
