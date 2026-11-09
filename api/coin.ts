import { HttpError, handle, pk } from "./_lib/solana";
import { loadCoins } from "./_lib/coins";

export default handle(async (req, res) => {
  const mint = pk(req.query.mint, "mint").toBase58();
  const [row] = await loadCoins([mint], { withVesting: true });
  if (!row) throw new HttpError(404, "This coin is not on LaunchLab.");
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=20");
  return { coin: row, now: Math.floor(Date.now() / 1000) };
});
