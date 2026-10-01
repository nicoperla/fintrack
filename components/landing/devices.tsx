"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Lock, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** A modern phone: thin bezel, punch-hole camera, side buttons and a glass glare. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[2.9rem] bg-gradient-to-b from-zinc-600 via-zinc-900 to-zinc-700 p-[9px] shadow-[0_0_90px_-15px_rgba(129,140,248,0.55),0_50px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/20",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute top-28 -left-[3px] h-12 w-[3px] rounded-l bg-zinc-600"
      />
      <span
        aria-hidden
        className="absolute top-44 -left-[3px] h-12 w-[3px] rounded-l bg-zinc-600"
      />
      <span
        aria-hidden
        className="absolute top-36 -right-[3px] h-16 w-[3px] rounded-r bg-zinc-600"
      />
      <div className="relative aspect-[390/844] overflow-hidden rounded-[2.35rem] bg-black">
        {children}
        <span
          aria-hidden
          className="absolute top-2 left-1/2 z-10 size-2.5 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.09]"
        />
      </div>
    </div>
  );
}

/** A browser window around a desktop screenshot or video. */
export function BrowserFrame({
  children,
  title = "FinTrack",
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span aria-hidden className="size-3 rounded-full bg-[#ff5f57]" />
        <span aria-hidden className="size-3 rounded-full bg-[#febc2e]" />
        <span aria-hidden className="size-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1 text-xs text-white/50">
          <Lock className="size-3" aria-hidden /> {title}
        </span>
        <span aria-hidden className="w-12" />
      </div>
      {children}
    </div>
  );
}

export type SmartVideoHandle = { seek: (seconds: number) => void };

/**
 * A muted, looping demo video that loads only when it gets close to the screen, plays while
 * visible and pauses when not. With reduced motion or data saving it waits for a tap. Always has
 * a pause button.
 */
export const SmartVideo = forwardRef<
  SmartVideoHandle,
  {
    src: string;
    poster: string;
    label: string;
    className?: string;
    onTime?: (seconds: number) => void;
    buttonClassName?: string;
  }
>(function SmartVideo({ src, poster, label, className, onTime, buttonClassName }, ref) {
  const wrapper = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);
  const visible = useRef(false);

  const autoplayAllowed = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    return !reduce && !saveData;
  }, []);

  useEffect(() => {
    const el = wrapper.current!;
    const loader = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          loader.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    const player = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        const v = video.current;
        if (!v) return;
        if (entry.isIntersecting && !userPaused.current && autoplayAllowed()) {
          v.play().catch(() => {});
        } else if (!entry.isIntersecting) {
          v.pause();
        }
      },
      { threshold: 0.35 },
    );
    loader.observe(el);
    player.observe(el);
    return () => {
      loader.disconnect();
      player.disconnect();
    };
  }, [autoplayAllowed]);

  // Once the source is set, start right away if the video is already on screen.
  useEffect(() => {
    if (near && visible.current && !userPaused.current && autoplayAllowed()) {
      video.current?.play().catch(() => {});
    }
  }, [near, autoplayAllowed]);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const v = video.current;
      if (!v) return;
      setNear(true);
      userPaused.current = false;
      v.currentTime = seconds;
      v.play().catch(() => {});
    },
  }));

  function toggle() {
    const v = video.current;
    if (!v) return;
    setNear(true);
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  }

  return (
    <div ref={wrapper} className="relative h-full w-full">
      <video
        ref={video}
        className={cn("block h-full w-full object-cover", className)}
        src={near ? src : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Metti in pausa il video" : "Riproduci il video"}
        className={cn(
          "absolute right-3 bottom-3 z-20 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
          buttonClassName,
        )}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
    </div>
  );
});
