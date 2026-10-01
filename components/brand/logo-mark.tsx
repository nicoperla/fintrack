import { cn } from "@/lib/utils";

/**
 * The FinTrack mark: a small glowing planet with a moon in orbit. The faint ring takes the text
 * colour, so it works on the dark landing page and on both app themes. A faster moon is the
 * loading indicator.
 */
export function LogoMark({ className, seconds = 4 }: { className?: string; seconds?: number }) {
  return (
    <span aria-hidden className={cn("relative flex size-7 items-center justify-center", className)}>
      <span className="size-3.5 rounded-full bg-gradient-to-br from-indigo-300 via-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
      <span
        className="lp-motion absolute inset-0"
        style={{ animation: `lp-orbit ${seconds}s linear infinite` }}
      >
        <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
      </span>
      <span className="absolute inset-0 rounded-full border border-current opacity-15" />
    </span>
  );
}
