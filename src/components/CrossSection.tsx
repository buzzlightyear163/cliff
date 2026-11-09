import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// The signature drawing: the dev's bag as a rock cross-section.
// Height = how much of the supply is locked. The flat top = the wait (curve + cliff).
// The slope = the linear release. Where it meets the water, the tokens are free to sell.

type Props = {
  lockRate: number;
  cliffDays: number;
  unlockDays: number;
  now?: { phase: "curve" | "cliff" | "unlocking" | "unlocked"; fill?: number; daysIntoCliff?: number; daysIntoUnlock?: number } | null;
  compact?: boolean;
  intro?: boolean;
};

// Visual height: 5% of supply reads as a low ledge, 20% as a tall wall.
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

function useTween(target: { h: number; c: number; u: number }, intro: boolean) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [v, setV] = useState(() => (intro && !reduce ? { h: 0, c: target.c, u: target.u } : target));
  const from = useRef(v);
  useEffect(() => {
    if (reduce) {
      setV(target);
      return;
    }
    const start = performance.now();
    const a = { ...from.current };
    const dur = a.h === 0 ? 1100 : 420;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const next = { h: a.h + (target.h - a.h) * e, c: a.c + (target.c - a.c) * e, u: a.u + (target.u - a.u) * e };
      from.current = next;
      setV(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.h, target.c, target.u]);
  return v;
}

// deterministic pseudo-random for the strata
function rand(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function CrossSection({ lockRate, cliffDays, unlockDays, now, compact, intro }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(320, width);
  const narrow = W < 640;
  const H = compact ? 220 : narrow ? 270 : 330;
  const ground = H - (compact ? 56 : narrow ? 70 : 66);
  const x0 = narrow || compact ? 16 : 56;
  const xGrad = x0 + (narrow || compact ? Math.max(70, W * 0.16) : Math.min(240, W * 0.2));
  const xMax = W - (narrow || compact ? 12 : 40);
  const span = Math.max(cliffDays + unlockDays, 1);
  // Partly fixed time scale: longer locks visibly reach further, short ones still read.
  const k = (xMax - (narrow || compact ? 34 : 70) - xGrad) / (Math.max(span, 180) * 1.12);
  const maxH = ground - (compact ? 40 : 54);

  const target = useMemo(
    () => ({ h: heightFor(lockRate) * maxH, c: cliffDays * k, u: unlockDays * k }),
    [lockRate, cliffDays, unlockDays, k, maxH],
  );
  const g = useTween(target, !!intro);

  const top = ground - Math.max(g.h, 0);
  const xCliff = xGrad + g.c;
  const xFree = xCliff + g.u;
  const rock = `M${x0},${ground} L${x0},${top} L${xCliff},${top} L${xFree},${ground} Z`;

  const strata = useMemo(() => {
    const bands: { y: number; h: number; tone: number; nod: boolean; w: number }[] = [];
    let y = ground;
    let i = 0;
    while (y > ground - maxH - 30) {
      const h = 7 + rand(i) * 13;
      bands.push({ y: y - h, h, tone: i % 3, nod: i % 3 === 1, w: rand(i + 50) > 0.65 ? 1.3 : 0.7 });
      y -= h;
      i++;
    }
    return bands;
  }, [ground, maxH]);

  const nodules = useMemo(() => {
    const out: { x: number; y: number; rx: number; ry: number }[] = [];
    strata.forEach((s, li) => {
      if (!s.nod) return;
      for (let x = x0 + 4 + rand(li) * 12; x < xMax; x += 12 + rand(li * 31 + x) * 34) {
        out.push({ x, y: s.y + s.h * (0.35 + rand(x + li * 7) * 0.3), rx: 2.2 + rand(x + li) * 5.5, ry: 1.3 + rand(x * 2 + li) * 1.5 });
      }
    });
    return out;
  }, [strata, x0, xMax]);

  const id = useMemo(() => `r${Math.random().toString(36).slice(2, 8)}`, []);

  // cartographic cliff hachures along the release slope
  const hachures = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const len = Math.hypot(xFree - xCliff, ground - top);
    if (len < 10) return out;
    const ux = (xFree - xCliff) / len, uy = (ground - top) / len;
    const nx = -uy, ny = ux; // points into the rock (down-left)
    for (let d = 5; d < len - 4; d += 6.5) {
      const L = 6 + rand(d) * 10;
      const x = xCliff + ux * d, y = top + uy * d;
      out.push({ x1: x, y1: y, x2: x - Math.abs(nx) * L * 0.55 - ux * L * 0.2, y2: y + Math.abs(ny) * L * 0.9 });
    }
    return out;
  }, [xCliff, xFree, top, ground]);
  const fs = compact ? 12 : 13;
  const dimY = ground + (compact ? 24 : 30);

  let nowX: number | null = null;
  if (now) {
    if (now.phase === "curve") nowX = x0 + (xGrad - x0) * Math.min(1, Math.max(0.04, now.fill ?? 0));
    else if (now.phase === "cliff") nowX = xGrad + Math.min(g.c, (now.daysIntoCliff ?? 0) * k);
    else if (now.phase === "unlocking") nowX = xCliff + Math.min(g.u, (now.daysIntoUnlock ?? 0) * k);
    else nowX = xFree + 14;
  }
  const lockLabel = `Dev bag ${Math.round(lockRate * 100)}% of supply`;

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg className="xsec" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${lockLabel}. Locked until ${cliffDays} days after graduation, then released over ${unlockDays} days.`}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={rock} />
          </clipPath>
          <pattern id={`${id}-water`} width="18" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 3.5 Q4.5 0.5 9 3.5 T18 3.5" fill="none" stroke="var(--sea-2)" strokeWidth="1" opacity="0.55" />
          </pattern>
          <pattern id={`${id}-bed`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--stone-3)" strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* bedrock under everything */}
        <rect x={x0} y={ground} width={xMax - x0} height={10} fill={`url(#${id}-bed)`} />
        <line x1={x0} x2={xMax} y1={ground} y2={ground} stroke="var(--flint)" strokeWidth="1" />

        {/* water: tokens that are free */}
        <rect x={xFree} y={ground - 15} width={Math.max(0, xMax - xFree)} height={15} fill={`url(#${id}-water)`} />

        {/* the rock */}
        <path d={rock} fill="var(--stone-1)" />
        <g clipPath={`url(#${id}-clip)`}>
          {strata.map((s, i) => (
            <g key={i}>
              <rect x={x0} y={s.y} width={xMax - x0} height={s.h} fill={s.tone === 0 ? "var(--stone-1)" : s.tone === 1 ? "#d7ddd8" : "var(--stone-2)"} />
              <line x1={x0} x2={xMax} y1={s.y} y2={s.y} stroke="var(--stone-3)" strokeWidth={s.w} />
            </g>
          ))}
          {nodules.map((n, i) => (
            <ellipse key={i} cx={n.x} cy={n.y} rx={n.rx} ry={n.ry} fill="var(--flint-2)" opacity="0.85" />
          ))}
          {hachures.map((h, i) => (
            <line key={`h${i}`} x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke="var(--flint)" strokeWidth="1.1" opacity="0.55" />
          ))}
        </g>
        <path d={`M${x0},${ground} L${x0},${top} L${xCliff},${top}`} fill="none" stroke="var(--flint)" strokeWidth="2.25" strokeLinejoin="round" />
        <path d={`M${xCliff},${top} L${xFree},${ground}`} fill="none" stroke="var(--sea)" strokeWidth="3" strokeLinecap="round" />

        {/* graduation marker */}
        <line x1={xGrad} x2={xGrad} y1={ground + 4} y2={Math.min(top, ground - 8) - 26} stroke="var(--flint)" strokeWidth="1" strokeDasharray="3 3" />
        <text
          x={nowX != null && nowX > xGrad - 4 && nowX < xGrad + 96 ? xGrad - 6 : xGrad + 6}
          textAnchor={nowX != null && nowX > xGrad - 4 && nowX < xGrad + 96 ? "end" : "start"}
          y={Math.min(top, ground - 8) - 30}
          fontSize={fs}
          fontWeight={650}
          fill="var(--flint)"
        >
          Graduation
        </text>

        {/* bag label */}
        {g.h > 30 && xGrad - x0 > lockLabel.length * fs * 0.55 + 20 && (
          <text x={x0 + 2} y={top - 10} fontSize={fs} fontWeight={600} fill="var(--flint)">
            {lockLabel}
          </text>
        )}

        {/* free label */}
        {xMax - xFree > 90 && (
          <text x={Math.min(xFree + 12, xMax - 90)} y={ground - 22} fontSize={fs} fill="var(--sea)" fontWeight={600}>
            Free to sell
          </text>
        )}

        {/* dimension lines */}
        <Dim x1={x0} x2={xGrad} y={dimY} label="On the curve" fs={fs} dashed optional />
        <Dim x1={xGrad} x2={xCliff} y={dimY} label={`Cliff ${Math.round(cliffDays)}d`} fs={fs} />
        <Dim x1={xCliff} x2={xFree} y={dimY} label={`Release ${Math.round(unlockDays)}d`} fs={fs} sea below={2} />

        {nowX != null && (
          <g>
            <line x1={nowX} x2={nowX} y1={ground + 2} y2={20} stroke="var(--sea)" strokeWidth="1.5" />
            <circle cx={nowX} cy={20} r={4} fill="var(--sea)" />
            <text x={nowX + 8} y={24} fontSize={fs} fontWeight={700} fill="var(--sea)">
              Now
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function Dim({ x1, x2, y, label, fs, dashed, sea, optional, below = 1 }: { x1: number; x2: number; y: number; label: string; fs: number; dashed?: boolean; sea?: boolean; optional?: boolean; below?: number }) {
  const w = x2 - x1;
  const color = sea ? "var(--sea)" : "var(--shale)";
  const fits = w > label.length * fs * 0.52 + 10;
  return (
    <g>
      <line x1={x1} x2={x1} y1={y - 6} y2={y + 6} stroke={color} strokeWidth="1" />
      <line x1={x2} x2={x2} y1={y - 6} y2={y + 6} stroke={color} strokeWidth="1" />
      <line x1={x1 + 1} x2={x2 - 1} y1={y} y2={y} stroke={color} strokeWidth="1" strokeDasharray={dashed ? "2 3" : undefined} />
      {fits ? (
        <>
          <rect x={(x1 + x2) / 2 - label.length * fs * 0.27 - 5} y={y - fs / 2 - 2} width={label.length * fs * 0.54 + 10} height={fs + 4} fill="var(--paper)" />
          <text x={(x1 + x2) / 2} y={y + fs * 0.35} fontSize={fs} textAnchor="middle" fill={color} fontWeight={600}>
            {label}
          </text>
        </>
      ) : optional ? null : (
        <text x={(x1 + x2) / 2} y={y + (fs + 4) * below + 4} fontSize={fs - 1} textAnchor="middle" fill={color} fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  );
}
