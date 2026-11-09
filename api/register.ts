import { RULES } from "../shared/curve";
import { HttpError, body, handle, pk } from "./_lib/solana";
import { putFile } from "./_lib/store";
import { loadCoins } from "./_lib/coins";

// Adds a launch to the CLIFF board once it is on chain with a qualifying lock.
export default handle(async (req) => {
  const b = body(req);
  const mint = pk(b.mint, "mint").toBase58();
  let row = null;
  for (let i = 0; i < 4 && !row; i++) {
    [row] = await loadCoins([mint]);
    if (!row) await new Promise((r) => setTimeout(r, 1500));
  }
  if (!row) throw new HttpError(404, "The launch is not on chain yet. Try again in a few seconds.");
  if (row.lockRate < RULES.minLock - 1e-6 || row.cliffDays < RULES.minCliffDays || row.unlockDays < RULES.minUnlockDays)
    throw new HttpError(400, "This coin does not lock enough of the dev bag to be listed.");
  await putFile(`launches/${mint}.json`, JSON.stringify({ mint, at: Date.now() }), "application/json");
  return { ok: true, mint };
});
