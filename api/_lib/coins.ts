import { PublicKey } from "@solana/web3.js";
import { LAUNCHPAD_PROGRAM, LaunchpadPool, LaunchpadVesting, getPdaLaunchpadPoolId } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { connection, launchApi, vestRecordId } from "./solana";

export type CoinRow = {
  mint: string;
  poolId: string;
  name: string;
  symbol: string;
  image: string | null;
  creator: string;
  createdAt: number | null; // ms
  platformId: string;
  status: "curve" | "graduating" | "graduated";
  mcSol: number | null;
  mcUsd: number | null;
  fill: number; // 0..1 curve progress
  raiseSol: number;
  startMcSol: number;
  gradMcSol: number;
  lockRate: number;
  lockTokens: number;
  cliffDays: number;
  unlockDays: number;
  startTime: number | null; // unix s, vesting start (graduation + cliff)
  allocated: number; // tokens allocated to beneficiaries
  claimed: number | null; // tokens the creator has claimed
  devShare: number | null; // tokens allocated to the creator
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
};

const SUPPLY_DIV = 1e6;

function decodePool(data: Buffer) {
  return LaunchpadPool.decode(data);
}

type Pool = ReturnType<typeof decodePool>;

function n(b: { toString(): string }) {
  return Number(b.toString());
}

export function poolIdFor(mint: string) {
  return getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, new PublicKey(mint), NATIVE_MINT).publicKey;
}

function fromPool(mint: string, poolId: PublicKey, p: Pool): CoinRow {
  const supply = n(p.supply);
  const vA = n(p.virtualA), vB = n(p.virtualB), rA = n(p.realA), rB = n(p.realB);
  const priceLamportsPerRaw = (vB + rB) / (vA - rA);
  const mcSol = (priceLamportsPerRaw * supply) / 1e9;
  const startMcSol = ((vB / vA) * supply) / 1e9;
  const sellA = n(p.totalSellA), locked = n(p.vestingSchedule.totalLockedAmount), raise = n(p.totalFundRaisingB);
  const migrateAmt = supply - sellA - locked;
  const gradMcSol = migrateAmt > 0 ? (((raise - n(p.migrateFee)) / migrateAmt) * supply) / 1e9 : 0;
  const status = p.status === 0 ? "curve" : p.status === 1 ? "graduating" : "graduated";
  const startTime = n(p.vestingSchedule.startTime);
  return {
    mint,
    poolId: poolId.toBase58(),
    name: "",
    symbol: "",
    image: null,
    creator: p.creator.toBase58(),
    createdAt: null,
    platformId: p.platformId.toBase58(),
    status,
    mcSol: status === "curve" ? mcSol : null,
    mcUsd: null,
    fill: Math.min(1, raise > 0 ? rB / raise : 0),
    raiseSol: raise / 1e9,
    startMcSol,
    gradMcSol,
    lockRate: supply > 0 ? locked / supply : 0,
    lockTokens: locked / SUPPLY_DIV,
    cliffDays: n(p.vestingSchedule.cliffPeriod) / 86400,
    unlockDays: n(p.vestingSchedule.unlockPeriod) / 86400,
    startTime: startTime > 0 ? startTime : null,
    allocated: n(p.vestingSchedule.totalAllocatedShare) / SUPPLY_DIV,
    claimed: null,
    devShare: null,
  };
}

async function chunked<T, R>(items: T[], size: number, fn: (c: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}

export async function loadCoins(mints: string[], opts: { withVesting?: boolean } = {}): Promise<CoinRow[]> {
  const uniq = Array.from(new Set(mints)).slice(0, 300);
  if (!uniq.length) return [];
  const conn = connection();
  const poolIds = uniq.map((m) => poolIdFor(m));
  const accs = await chunked(poolIds, 100, (c) => conn.getMultipleAccountsInfo(c));
  const rows: CoinRow[] = [];
  uniq.forEach((mint, i) => {
    const a = accs[i];
    if (!a) return;
    try {
      rows.push(fromPool(mint, poolIds[i], decodePool(a.data)));
    } catch {}
  });

  // Names, images and links from Raydium's LaunchLab index.
  await chunked(rows, 40, async (c) => {
    try {
      const d = await launchApi<{ rows: any[] }>(`/get/by/mints?ids=${c.map((r) => r.mint).join(",")}`);
      for (const api of d.rows || []) {
        const row = c.find((r) => r.mint === api.mint);
        if (!row) continue;
        row.name = api.name || row.name;
        row.symbol = api.symbol || row.symbol;
        row.image = api.imgUrl || null;
        row.createdAt = api.createAt ?? null;
        row.website = api.website || undefined;
        row.twitter = api.twitter || undefined;
        row.telegram = api.telegram || undefined;
        row.description = api.description || undefined;
      }
    } catch {}
    return [];
  });

  // Market caps of graduated coins from DexScreener.
  const grads = rows.filter((r) => r.status !== "curve");
  await chunked(grads, 30, async (c) => {
    try {
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${c.map((x) => x.mint).join(",")}`);
      const pairs: any[] = await r.json();
      for (const row of c) {
        const best = pairs
          .filter((p) => p?.baseToken?.address === row.mint)
          .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
        if (best?.marketCap) row.mcUsd = Number(best.marketCap);
      }
    } catch {}
    return [];
  });

  if (opts.withVesting) {
    const recIds = rows.map((r) => vestRecordId(new PublicKey(r.poolId), new PublicKey(r.creator)));
    const recs = await chunked(recIds, 100, (c) => conn.getMultipleAccountsInfo(c));
    rows.forEach((row, i) => {
      const a = recs[i];
      if (!a) return;
      try {
        const v = LaunchpadVesting.decode(a.data);
        row.devShare = n(v.tokenShareAmount) / SUPPLY_DIV;
        row.claimed = n(v.claimedAmount) / SUPPLY_DIV;
      } catch {}
    });
  }
  return rows;
}
