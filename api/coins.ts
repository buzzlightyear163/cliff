import { RULES } from "../shared/curve";
import { handle, launchApi, ownPlatformId } from "./_lib/solana";
import { listJson } from "./_lib/store";
import { loadCoins } from "./_lib/coins";

let cache: { at: number; v: any } | null = null;

async function elsewhere() {
  try {
    const d = await launchApi<{ rows: any[] }>("/get/list?sort=new&size=100&mintType=default&includeNsfw=false");
    const rows = (d.rows || []).filter((r) => r?.configInfo?.mintB === "So11111111111111111111111111111111111111112" || r?.mintB?.address);
    const total = rows.length;
    const unlocked = rows.filter((r) => !Number(r.totalLockedAmount)).length;
    return {
      total,
      noLock: unlocked,
      recent: rows.slice(0, 12).map((r) => ({
        mint: r.mint,
        name: r.name,
        symbol: r.symbol,
        image: r.imgUrl || null,
        createdAt: r.createAt ?? null,
        platform: r.platformInfo?.name || "",
        lockRate: Number(r.supply) > 0 ? Number(r.totalLockedAmount || 0) / Number(r.supply) : 0,
        cliffDays: Number(r.cliffPeriod || 0) / 86400,
        unlockDays: Number(r.unlockPeriod || 0) / 86400,
        fill: Number(r.finishingRate || 0) / 100,
      })),
    };
  } catch {
    return { total: 0, noLock: 0, recent: [] };
  }
}

export default handle(async (_req, res) => {
  if (cache && Date.now() - cache.at < 15_000) {
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return cache.v;
  }
  const registry = await listJson<{ mint: string }>("launches/");
  const mints = registry.map((r) => r.mint);
  if (process.env.CLIFF_CA) mints.unshift(process.env.CLIFF_CA.trim());
  const own = ownPlatformId();
  if (own) {
    try {
      const d = await launchApi<{ rows: any[] }>(`/get/list?sort=new&size=100&mintType=default&includeNsfw=true&platformId=${own.toBase58()}`);
      for (const r of d.rows || []) mints.push(r.mint);
    } catch {}
  }
  const [rows, other] = await Promise.all([loadCoins(mints, { withVesting: true }), elsewhere()]);
  const coins = rows
    .filter((r) => r.lockRate >= RULES.minLock - 1e-6 && r.cliffDays >= RULES.minCliffDays && r.unlockDays >= RULES.minUnlockDays)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const v = {
    at: Date.now(),
    coins,
    stats: {
      launched: coins.length,
      onCurve: coins.filter((c) => c.status === "curve").length,
      graduated: coins.filter((c) => c.status !== "curve").length,
      lockedTokens: coins.reduce((s, c) => s + c.lockTokens - (c.claimed ?? 0), 0),
    },
    elsewhere: other,
  };
  cache = { at: Date.now(), v };
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  return v;
});
