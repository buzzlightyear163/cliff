import { activePlatform, handle, ownPlatformId, solUsd } from "./_lib/solana";

let cache: { at: number; v: any } | null = null;

export default handle(async (_req, res) => {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
  if (cache && Date.now() - cache.at < 20_000) return cache.v;
  const [platform, sol] = await Promise.all([
    activePlatform().catch(() => null),
    solUsd().catch(() => ({ usd: 0, change24h: null })),
  ]);
  const v = {
    ticker: "CLIFF",
    ca: process.env.CLIFF_CA || null,
    x: process.env.X_URL || null,
    platform,
    ownPlatformExpected: ownPlatformId()?.toBase58() ?? null,
    protocolFee: 0.0025,
    solUsd: sol.usd,
  };
  cache = { at: Date.now(), v };
  return v;
});
