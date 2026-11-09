export function usd(v: number | null | undefined, opts: { exact?: boolean } = {}) {
  if (v == null || !isFinite(v)) return "–";
  if (!opts.exact && v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (!opts.exact && v >= 10_000) return `$${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function sol(v: number | null | undefined, digits = 1) {
  if (v == null || !isFinite(v)) return "–";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })} SOL`;
}

export function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

export function tokens(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return Math.round(v).toLocaleString("en-US");
}

export function days(d: number) {
  const r = Math.round(d);
  return `${r} day${r === 1 ? "" : "s"}`;
}

export function short(a: string, n = 4) {
  return a ? `${a.slice(0, n)}…${a.slice(-n)}` : "";
}

export function until(secs: number) {
  if (secs <= 0) return "now";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function ago(ms: number | null) {
  if (!ms) return "–";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

export function date(secs: number) {
  return new Date(secs * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
