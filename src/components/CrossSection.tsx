import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// The signature drawing, as an LED panel: the dev's bag as a block of lit dots.
// Height = how much of the supply is locked. The flat top = the wait (curve + cliff).
// The blue slope = the linear release. Where it reaches the water, the tokens are free to sell.

type Now = { phase: "curve" | "cliff" | "unlocking" | "unlocked"; fill?: number; daysIntoCliff?: number; daysIntoUnlock?: number };
type Props = {
  lockRate: number;
  cliffDays: number;
  unlockDays: number;
  now?: Now | null;
  compact?: boolean;
  intro?: boolean;
};

const C = {
  bg: "#10161a",
  off: "#1b252b",
  mass: "#3b4a52",
  strata: "#4d5e67",
  edge: "#eef3f1",
  accent: "#5cc6e0",
  mute: "#8a979d",
  line: "#2a363d",
};

function heightFor(lock: number) {
  if (lock < 0.05) return 0.4 * Math.max(0, lock / 0.05);
  return 0.4 + 0.6 * Math.min(1, (lock - 0.05) / 0.15);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(1100);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth || 1100);
    const ro = new ResizeObserver(() => setW(el.clientWidth || 1100));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function CrossSection({ lockRate, cliffDays, unlockDays, now, compact, intro }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const W = Math.max(300, Math.floor(width));
  const narrow = W < 640;
  const H = compact ? 230 : narrow ? 270 : 340;
  const ground = H - (compact ? 58 : 68);
  const x0 = narrow || compact ? 18 : 56;
  const xGrad = x0 + (narrow || compact ? Math.max(70, W * 0.16) : Math.min(240, W * 0.2));
  const xMax = W - (narrow || compact ? 12 : 40);
  const span = Math.max(cliffDays + unlockDays, 1);
  const k = (xMax - (narrow || compact ? 34 : 70) - xGrad) / (Math.max(span, 180) * 1.12);
  const maxH = ground - (compact ? 44 : 58);
  const pitch = compact || narrow ? 8 : 11;

  const target = useMemo(() => ({ h: heightFor(lockRate) * maxH, c: cliffDays * k, u: unlockDays * k }), [lockRate, cliffDays, unlockDays, k, maxH]);

  // tween the shape, and sweep the dots on for the first render
  const [g, setG] = useState(target);
  const [sweep, setSweep] = useState(intro && !reduceMotion() ? 0 : 1);
  const from = useRef(target);
  useEffect(() => {
    if (reduceMotion()) {
      from.current = target;
      setG(target);
      return;
    }
    const start = performance.now();
    const a = { ...from.current };
    let raf = 0;
    const step = (t: number) => {
      const q = Math.min(1, (t - start) / 380);
      const e = 1 - Math.pow(1 - q, 3);
      const next = { h: a.h + (target.h - a.h) * e, c: a.c + (target.c - a.c) * e, u: a.u + (target.u - a.u) * e };
      from.current = next;
      setG(next);
      if (q < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.h, target.c, target.u]);
  useEffect(() => {
    if (sweep >= 1) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const q = Math.min(1, (t - start) / 1200);
      setSweep(1 - Math.pow(1 - q, 2));
      if (q < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  const top = ground - Math.max(g.h, 0);
  const xCliff = xGrad + g.c;
  const xFree = xCliff + g.u;

  let nowX: number | null = null;
  if (now) {
    if (now.phase === "curve") nowX = x0 + (xGrad - x0) * Math.min(1, Math.max(0.04, now.fill ?? 0));
    else if (now.phase === "cliff") nowX = xGrad + Math.min(g.c, (now.daysIntoCliff ?? 0) * k);
    else if (now.phase === "unlocking") nowX = xCliff + Math.min(g.u, (now.daysIntoUnlock ?? 0) * k);
    else nowX = Math.min(xMax - 10, xFree + 16);
  }

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const fs = compact ? 11.5 : 12.5;
    const font = (w: number) => `${w} ${fs}px "Archivo Variable", Archivo, system-ui, sans-serif`;

    const sweepX = x0 + (xMax - x0 + 40) * sweep;
    const slopeAt = (y: number) => (ground - top < 1 ? xCliff : xCliff + ((y - top) / (ground - top)) * (xFree - xCliff));
    const rOn = pitch * 0.36;
    const rOff = pitch * 0.13;
    const rows = Math.floor(ground / pitch);
    for (let ri = 0; ri <= rows; ri++) {
      const cy = ground - ri * pitch - pitch / 2;
      if (cy < 4) break;
      for (let cx = pitch / 2; cx < W; cx += pitch) {
        let col: string | null = null;
        let r = rOff;
        let alpha = 1;
        const inside = cx >= x0 && cy >= top && cx <= slopeAt(cy);
        if (inside && cx <= sweepX) {
          r = rOn;
          // the release edge reads as a staircase, like the steps in the logo
          const stepW = Math.max(pitch, ((xFree - xCliff) / Math.max(1, (ground - top) / pitch)) + pitch * 0.2);
          const nearSlope = cx > slopeAt(cy) - stepW && cx > xCliff - pitch * 0.5;
          if (nearSlope) col = C.accent;
          else if (cy < top + pitch || cx < x0 + pitch) col = C.edge;
          else col = ri % 4 === 0 ? C.strata : C.mass;
        } else if (cx > xFree + pitch * 0.6 && cx < xMax && ri < 2 && cx <= sweepX) {
          col = C.accent;
          r = rOn * 0.62;
          alpha = ri === 0 ? 0.55 : 0.28;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col ?? C.off;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ground line
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, ground + 3);
    ctx.lineTo(xMax, ground + 3);
    ctx.stroke();

    // graduation marker
    const gradTop = Math.min(top, ground - 8) - 24;
    ctx.strokeStyle = C.mute;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(xGrad, ground + 6);
    ctx.lineTo(xGrad, gradTop);
    ctx.stroke();
    ctx.setLineDash([]);
    const gradLeft = nowX != null && nowX > xGrad - 4 && nowX < xGrad + 96;
    ctx.font = font(650);
    ctx.fillStyle = C.edge;
    ctx.textAlign = gradLeft ? "right" : "left";
    ctx.fillText("Graduation", gradLeft ? xGrad - 7 : xGrad + 7, gradTop + 4);

    // bag label
    const lockLabel = `Dev bag ${Math.round(lockRate * 100)}% of supply`;
    ctx.font = font(600);
    const lw = ctx.measureText(lockLabel).width;
    if (g.h > 30 && xGrad - x0 > lw + 16) {
      ctx.textAlign = "left";
      ctx.fillStyle = C.edge;
      ctx.fillText(lockLabel, x0, top - 12);
    }

    // free label
    if (xMax - xFree > 96 && sweep > 0.95) {
      ctx.textAlign = "left";
      ctx.fillStyle = C.accent;
      ctx.fillText("Free to sell", Math.min(xFree + 12, xMax - 92), ground - pitch * 2 - 8);
    }

    // dimension lines
    const dimY = ground + (compact ? 26 : 32);
    const dim = (a: number, b: number, label: string, color: string, opts: { dashed?: boolean; optional?: boolean; below?: number } = {}) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a, dimY - 6);
      ctx.lineTo(a, dimY + 6);
      ctx.moveTo(b, dimY - 6);
      ctx.lineTo(b, dimY + 6);
      ctx.stroke();
      if (opts.dashed) ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(a + 1, dimY);
      ctx.lineTo(b - 1, dimY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(600);
      const tw = ctx.measureText(label).width;
      ctx.textAlign = "center";
      if (b - a > tw + 16) {
        ctx.fillStyle = C.bg;
        ctx.fillRect((a + b) / 2 - tw / 2 - 6, dimY - fs / 2 - 3, tw + 12, fs + 6);
        ctx.fillStyle = color;
        ctx.fillText(label, (a + b) / 2, dimY + fs * 0.36);
      } else if (!opts.optional) {
        ctx.fillStyle = color;
        ctx.fillText(label, Math.max(tw / 2 + 2, Math.min(W - tw / 2 - 2, (a + b) / 2)), dimY + (fs + 4) * (opts.below ?? 1) + 5);
      }
    };
    dim(x0, xGrad, "On the curve", C.mute, { dashed: true, optional: true });
    dim(xGrad, xCliff, `Cliff ${Math.round(cliffDays)}d`, C.mute);
    dim(xCliff, xFree, `Release ${Math.round(unlockDays)}d`, C.accent, { below: 2 });

    // now marker
    if (nowX != null) {
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nowX, ground + 2);
      ctx.lineTo(nowX, 22);
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(nowX, 20, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(nowX, 20, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = font(700);
      ctx.textAlign = "left";
      ctx.fillText("Now", nowX + 12, 24);
    }
  }, [W, H, g, sweep, nowX, fontsReady, lockRate, cliffDays, unlockDays, compact, pitch, ground, top, x0, xGrad, xCliff, xFree, xMax]);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <canvas
        ref={canvas}
        className="xsec"
        style={{ width: W, height: H, display: "block" }}
        role="img"
        aria-label={`Dev bag ${Math.round(lockRate * 100)}% of supply. Locked until ${cliffDays} days after graduation, then released over ${unlockDays} days.`}
      />
    </div>
  );
}
