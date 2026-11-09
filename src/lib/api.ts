export async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j as T;
}

export async function postJSON<T = any>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j as T;
}

export type Platform = {
  id: string;
  own: boolean;
  name: string;
  feeRate: number;
  creatorFeeRate: number;
  restrictCurveParam: boolean;
};

export type SiteConfig = {
  ticker: string;
  ca: string | null;
  x: string | null;
  platform: Platform | null;
  ownPlatformExpected: string | null;
  protocolFee: number;
  solUsd: number;
};

export type Coin = {
  mint: string;
  poolId: string;
  name: string;
  symbol: string;
  image: string | null;
  creator: string;
  createdAt: number | null;
  platformId: string;
  status: "curve" | "graduating" | "graduated";
  mcSol: number | null;
  mcUsd: number | null;
  fill: number;
  raiseSol: number;
  startMcSol: number;
  gradMcSol: number;
  lockRate: number;
  lockTokens: number;
  cliffDays: number;
  unlockDays: number;
  startTime: number | null;
  allocated: number;
  claimed: number | null;
  devShare: number | null;
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
};

export type Elsewhere = {
  total: number;
  noLock: number;
  recent: { mint: string; name: string; symbol: string; image: string | null; createdAt: number | null; platform: string; lockRate: number; cliffDays: number; unlockDays: number; fill: number }[];
};

export type Board = {
  at: number;
  coins: Coin[];
  stats: { launched: number; onCurve: number; graduated: number; lockedTokens: number };
  elsewhere: Elsewhere;
};
