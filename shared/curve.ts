// Shared launch math for CLIFF. Used by the site (live numbers) and by the API (the real launch).
// Matches Raydium LaunchLab's constant-product curve (checked against the SDK's getInitParam).

export const SUPPLY_TOKENS = 1_000_000_000; // 1B, 6 decimals
export const DECIMALS = 6;
export const DAY = 86_400;

// LaunchLab SOL global config (6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX)
export const LL = {
  configId: "6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX",
  minFundRaisingSol: 24,
  minSellRate: 0.2,
  minMigrateRate: 0.15,
  maxLockRate: 0.8,
  protocolFee: 0.0025,
  defaultStartMcSol: 27.96,
  defaultGradMcSol: 410.83,
};

// CLIFF's own rules. These are what the platform curve rule enforces once the platform is live.
export const LOCK_OPTIONS = [0.05, 0.1, 0.15, 0.2];
export const CLIFF_OPTIONS = [7, 14, 30, 60]; // days after graduation
export const UNLOCK_OPTIONS = [30, 90, 180]; // days of linear release
export const RULES = {
  minLock: 0.05,
  maxLock: 0.2,
  minCliffDays: 7,
  minUnlockDays: 30,
};

export type CurvePreset = { id: string; name: string; note: string; startUsd: number | null; gradUsd: number | null };
export const CURVE_PRESETS: CurvePreset[] = [
  { id: "default", name: "LaunchLab standard", note: "Same start and graduation as any LaunchLab coin", startUsd: null, gradUsd: null },
  { id: "higher", name: "Higher start", note: "Skips the cheapest caps where farms buy", startUsd: 12_000, gradUsd: 90_000 },
  { id: "long", name: "Long curve", note: "Low start, late graduation", startUsd: 5_000, gradUsd: 120_000 },
];

export type LaunchPlanInput = {
  startMcSol: number;
  gradMcSol: number;
  lockRate: number; // 0..1 of supply
};

export type LaunchPlan = {
  ok: boolean;
  errors: string[];
  run: number;
  lockTokens: number;
  soldTokens: number;
  poolTokens: number;
  raiseSol: number;
  soldRate: number;
  poolRate: number;
  // raw on-chain values (strings, to keep bigint precision across JSON)
  raw: { supply: string; totalSellA: string; totalLockedAmount: string; totalFundRaisingB: string };
};

const RAW = 10n ** BigInt(DECIMALS);
const RAW_SUPPLY = BigInt(SUPPLY_TOKENS) * RAW;

export function planLaunch({ startMcSol, gradMcSol, lockRate }: LaunchPlanInput): LaunchPlan {
  const errors: string[] = [];
  const run = gradMcSol / startMcSol;
  const r = Math.sqrt(run);
  const lockPpm = BigInt(Math.round(lockRate * 1e6));
  const rawLock = (RAW_SUPPLY * lockPpm) / 1_000_000n;
  const freeTokens = Number(RAW_SUPPLY - rawLock) / 1e6;
  const poolTokens = freeTokens / (1 + r);
  const soldTokens = freeTokens - poolTokens;
  // graduation price = raise / poolTokens and mcap = price * supply  =>  raise = grad * pool / supply
  const raiseSol = (gradMcSol * poolTokens) / SUPPLY_TOKENS;

  const rawSell = BigInt(Math.floor(soldTokens * 1e6));
  const rawRaise = BigInt(Math.round(raiseSol * 1e9));

  const soldRate = soldTokens / SUPPLY_TOKENS;
  const poolRate = poolTokens / SUPPLY_TOKENS;
  if (!(run > 1.05)) errors.push("Graduation has to be above the start.");
  if (raiseSol < LL.minFundRaisingSol) errors.push(`The curve has to raise at least ${LL.minFundRaisingSol} SOL. Raise the graduation cap.`);
  if (soldRate < LL.minSellRate) errors.push("Too little of the supply is sold on the curve. Widen the gap between start and graduation.");
  if (poolRate < LL.minMigrateRate) errors.push("Too little supply would be left for the pool. Narrow the gap between start and graduation.");
  if (lockRate > LL.maxLockRate) errors.push("Lock is above LaunchLab's maximum.");

  return {
    ok: errors.length === 0,
    errors,
    run,
    lockTokens: Number(rawLock) / 1e6,
    soldTokens,
    poolTokens,
    raiseSol,
    soldRate,
    poolRate,
    raw: {
      supply: RAW_SUPPLY.toString(),
      totalSellA: rawSell.toString(),
      totalLockedAmount: rawLock.toString(),
      totalFundRaisingB: rawRaise.toString(),
    },
  };
}

// Vesting state of a dev bag at a given time.
export type VestState = {
  phase: "curve" | "cliff" | "unlocking" | "unlocked";
  unlockedRate: number; // 0..1 of the locked bag
  cliffEndsAt: number | null; // unix seconds
  fullyAt: number | null;
};

export function vestState(opts: {
  graduatedAt: number | null; // unix seconds when fundraising ended (null = still on the curve)
  startTime?: number | null; // on-chain vesting start (graduation + cliff); preferred when known
  cliffDays: number;
  unlockDays: number;
  now: number;
}): VestState {
  const { graduatedAt, cliffDays, unlockDays, now } = opts;
  const start = opts.startTime && opts.startTime > 0 ? opts.startTime : graduatedAt != null ? graduatedAt + cliffDays * DAY : null;
  if (start == null) return { phase: "curve", unlockedRate: 0, cliffEndsAt: null, fullyAt: null };
  const fully = start + unlockDays * DAY;
  if (now < start) return { phase: "cliff", unlockedRate: 0, cliffEndsAt: start, fullyAt: fully };
  if (unlockDays <= 0 || now >= fully) return { phase: "unlocked", unlockedRate: 1, cliffEndsAt: start, fullyAt: fully };
  return { phase: "unlocking", unlockedRate: (now - start) / (fully - start), cliffEndsAt: start, fullyAt: fully };
}
