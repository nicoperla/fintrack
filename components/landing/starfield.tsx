"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

/*
 * The landing page's sky: stars flying slowly towards the viewer on a canvas, twinkling, with a
 * shooting star now and then and a little parallax on the mouse. `useWarp()` lets any element
 * (the final call to action) push the sky into "light speed". Static with reduced motion, and
 * paused while the tab is hidden.
 */

type Warp = { setWarp: (on: boolean) => void };
const WarpContext = createContext<Warp>({ setWarp: () => {} });
export const useWarp = () => useContext(WarpContext);

type Star = {
  x: number;
  y: number;
  z: number;
  tint: string;
  phase: number;
  px?: number;
  py?: number;
};
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

const TINTS = ["255,255,255", "255,255,255", "199,210,254", "216,180,254", "165,243,252"];

export function StarfieldProvider({ children }: { children: ReactNode }) {
  const warpTarget = useRef(0);
  const setWarp = useCallback((on: boolean) => {
    warpTarget.current = on ? 1 : 0;
  }, []);
  return (
    <WarpContext.Provider value={{ setWarp }}>
      <Starfield warpTarget={warpTarget} />
      {children}
    </WarpContext.Provider>
  );
}

function Starfield({ warpTarget }: { warpTarget: { current: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let frame = 0;
    let last = performance.now();
    let warp = 0;
    let nextMeteor = last + 2500;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const spawn = (z = Math.random()): Star => ({
      x: (Math.random() * 2 - 1) * 1.4,
      y: (Math.random() * 2 - 1) * 1.4,
      z: Math.max(0.05, z),
      tint: TINTS[Math.floor(Math.random() * TINTS.length)],
      phase: Math.random() * Math.PI * 2,
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(420, Math.max(90, (width * height) / 3600)));
      stars = Array.from({ length: count }, () => spawn());
    }

    function draw(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      warp += (warpTarget.current - warp) * Math.min(1, dt * 2.5);
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2 - mouse.x * 30;
      const cy = height / 2 - mouse.y * 30;
      const fov = Math.max(width, height) * 0.5;
      const speed = reduce ? 0 : 0.035 + warp * 1.4;

      for (const s of stars) {
        s.z -= speed * dt;
        if (s.z <= 0.05) Object.assign(s, spawn(1), { px: undefined, py: undefined });
        const sx = cx + (s.x / s.z) * fov;
        const sy = cy + (s.y / s.z) * fov;
        if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) {
          Object.assign(s, spawn(1), { px: undefined, py: undefined });
          continue;
        }
        const depth = 1 - s.z;
        const twinkle = reduce ? 1 : 0.65 + 0.35 * Math.sin(now / 700 + s.phase);
        const alpha = Math.min(1, 0.15 + depth * 0.9) * twinkle;
        const size = 0.3 + depth * 1.6;
        if (warp > 0.05 && s.px !== undefined) {
          ctx.strokeStyle = `rgba(${s.tint},${alpha})`;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(s.px, s.py!);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${s.tint},${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
        s.px = sx;
        s.py = sy;
      }

      if (!reduce) {
        if (now > nextMeteor) {
          nextMeteor = now + 4500 + Math.random() * 5000;
          meteors.push({
            x: Math.random() * width * 0.8 + width * 0.1,
            y: Math.random() * height * 0.35,
            vx: -(380 + Math.random() * 260),
            vy: 160 + Math.random() * 120,
            life: 1,
          });
        }
        meteors = meteors.filter((m) => m.life > 0);
        for (const m of meteors) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.life -= dt * 0.9;
          const tail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.25, m.y - m.vy * 0.25);
          tail.addColorStop(0, `rgba(255,255,255,${0.9 * m.life})`);
          tail.addColorStop(1, "rgba(165,180,252,0)");
          ctx.strokeStyle = tail;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 0.25, m.y - m.vy * 0.25);
          ctx.stroke();
        }
        frame = requestAnimationFrame(draw);
      }
    }

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / width - 0.5;
      mouse.ty = e.clientY / height - 0.5;
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduce) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const onResize = () => {
      resize();
      if (reduce) draw(performance.now());
    };

    resize();
    if (reduce) draw(performance.now());
    else frame = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [warpTarget]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
