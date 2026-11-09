import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import CrossSection from "../components/CrossSection";
import Led from "../components/Led";
import { coinPhase, mcapUsd, useNow } from "../components/CoinTable";
import { getJSON, postJSON, type Coin } from "../lib/api";
import { useSendTx, useSite } from "../lib/site";
import { date, pct, short, tokens, until, usd } from "../lib/format";

export default function CoinPage() {
  const { mint = "" } = useParams();
  const [params] = useSearchParams();
  const [coin, setCoin] = useState<Coin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const { solUsd, toast } = useSite();
  const { publicKey } = useWallet();
  const sendTx = useSendTx();

  const load = useCallback(
    () =>
      getJSON<{ coin: Coin }>(`/api/coin?mint=${mint}`)
        .then((r) => {
          setCoin(r.coin);
          setError(null);
        })
        .catch((e) => setError(e.message)),
    [mint],
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (params.get("new")) toast("Launched. Your bag is locked on chain.");
  }, [params, toast]);

  if (error && !coin)
    return (
      <main className="wrap" style={{ padding: "60px 0" }}>
        <h1>Coin not found</h1>
        <p className="muted">{error}</p>
        <Link className="btn ghost" to="/board">Back to the board</Link>
      </main>
    );
  if (!coin) return <main className="wrap" style={{ padding: "60px 0" }} aria-busy="true"><p className="muted">Reading the pool from chain…</p></main>;

  const ph = coinPhase(coin, now);
  const isCreator = publicKey?.toBase58() === coin.creator;
  const startTime = coin.startTime ?? 0;
  const end = startTime + coin.unlockDays * 86400;
  const share = coin.devShare ?? 0;
  const unlockedRate = ph.phase === "unlocked" ? 1 : ph.phase === "unlocking" ? ph.rate ?? 0 : 0;
  const claimable = Math.max(0, share * unlockedRate - (coin.claimed ?? 0));
  const unassigned = Math.max(0, coin.lockTokens - coin.allocated);

  const nowMark =
    ph.phase === "curve"
      ? { phase: "curve" as const, fill: coin.fill }
      : ph.phase === "cliff"
      ? { phase: "cliff" as const, daysIntoCliff: coin.cliffDays - (startTime - now) / 86400 }
      : ph.phase === "unlocking"
      ? { phase: "unlocking" as const, daysIntoUnlock: (now - startTime) / 86400 }
      : { phase: "unlocked" as const };

  async function act(action: "claim" | "allocate") {
    if (!publicKey || !coin) return;
    setBusy(true);
    try {
      const b = await postJSON<{ tx: string }>("/api/build-claim", { owner: publicKey.toBase58(), poolId: coin.poolId, action });
      await sendTx(b.tx);
      toast(action === "claim" ? "Claimed." : "Bag assigned to your wallet.");
      load();
    } catch (e: any) {
      toast(String(e?.message || e).slice(0, 160));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div className="coin-head">
        {coin.image ? <img src={coin.image} alt="" /> : <span className="coin-img" style={{ width: 72, height: 72 }} />}
        <div>
          <h1>{coin.name || "Unnamed"}</h1>
          <div className="sym">${coin.symbol}</div>
        </div>
        <div className="coin-links">
          <a className="btn small" href={`https://raydium.io/launchpad/token/?mint=${coin.mint}`} target="_blank" rel="noreferrer">
            Trade on Raydium
          </a>
          <a className="btn ghost small" href={`https://dexscreener.com/solana/${coin.mint}`} target="_blank" rel="noreferrer">
            Chart
          </a>
          {coin.twitter && (
            <a className="btn ghost small" href={coin.twitter} target="_blank" rel="noreferrer">
              X
            </a>
          )}
          {coin.website && (
            <a className="btn ghost small" href={coin.website} target="_blank" rel="noreferrer">
              Website
            </a>
          )}
        </div>
      </div>
      <div className="ca-row">
        <span className="mono">{coin.mint}</span>
        <button className="copy" onClick={() => { navigator.clipboard?.writeText(coin.mint); toast("Contract address copied"); }}>
          Copy
        </button>
        <a href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer">
          Solscan
        </a>
        <span>Creator {short(coin.creator)}</span>
      </div>

      <p className="status-line">
        {ph.phase === "curve" && <>On the curve. The dev bag stays locked until {coin.cliffDays} days after graduation, then releases over {coin.unlockDays} days.</>}
        {coin.status !== "curve" && ph.phase === "curve" && <> Graduation is being processed.</>}
        {ph.phase === "cliff" && <>Graduated. The cliff is running, and nothing in the dev bag can move until it ends.</>}
        {ph.phase === "unlocking" && (
          <>
            Releasing. {pct(unlockedRate, 1)} of the dev bag is unlocked, all of it by {date(end)}.
          </>
        )}
        {ph.phase === "unlocked" && <>The dev bag finished releasing on {date(end)}.</>}
      </p>

      <div className="countdown-led">
        {ph.phase === "curve" && (
          <>
            <span className="k">Curve filled</span>
            <Led text={`${(coin.fill * 100).toFixed(1)}%`} pitch={6} />
          </>
        )}
        {ph.phase === "cliff" && (
          <>
            <span className="k">Dev bag starts unlocking in</span>
            <Led text={until(startTime - now).replace(/ /g, " ")} pitch={6} color="var(--accent)" />
          </>
        )}
        {ph.phase === "unlocking" && (
          <>
            <span className="k">Dev bag unlocked so far</span>
            <Led text={`${(unlockedRate * 100).toFixed(1)}%`} pitch={6} color="var(--accent)" />
          </>
        )}
      </div>

      <div className="section-card">
        <CrossSection lockRate={coin.lockRate} cliffDays={coin.cliffDays} unlockDays={coin.unlockDays} now={nowMark} />
        <div className="stats">
          <div className="stat">
            <div className="k">Dev bag</div>
            <div className="v">{tokens(coin.lockTokens)}</div>
            <div className="muted">{pct(coin.lockRate)} of supply</div>
          </div>
          <div className="stat">
            <div className="k">Unlocked so far</div>
            <div className="v">{tokens(coin.lockTokens * unlockedRate)}</div>
            <div className="muted">{coin.claimed != null ? `${tokens(coin.claimed)} claimed` : "Nothing claimed"}</div>
          </div>
          <div className="stat">
            <div className="k">Market cap</div>
            <div className="v">{usd(mcapUsd(coin, solUsd))}</div>
            <div className="muted">{coin.status === "curve" ? `Graduates at ${usd(coin.gradMcSol * solUsd)}` : "Graduated to Raydium"}</div>
          </div>
          <div className="stat">
            <div className="k">Assigned</div>
            <div className="v">{tokens(coin.allocated)}</div>
            <div className="muted">{unassigned > 1 ? `${tokens(unassigned)} not assigned, locked for good after graduation` : "Whole bag assigned to the creator"}</div>
          </div>
        </div>
      </div>

      {isCreator && (
        <section className="block" style={{ paddingTop: 36 }}>
          <div className="panel form-card">
            <h2>Your bag</h2>
            <p className="hint">You are the creator of this coin. Unlocked tokens go straight to this wallet when you claim.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {coin.status === "curve" && unassigned > 1 && (
                <button className="btn" disabled={busy} onClick={() => act("allocate")}>
                  Assign {tokens(unassigned)} to my wallet
                </button>
              )}
              <button className="btn" disabled={busy || claimable < 1} onClick={() => act("claim")}>
                {claimable >= 1 ? `Claim ${tokens(claimable)}` : "Nothing to claim yet"}
              </button>
              {ph.phase === "cliff" && <span className="muted">First unlock in {until(startTime - now)}.</span>}
            </div>
          </div>
        </section>
      )}

      {coin.description && (
        <section className="block" style={{ paddingTop: 36 }}>
          <h2 style={{ fontSize: 22 }}>About</h2>
          <p className="muted" style={{ maxWidth: "70ch", whiteSpace: "pre-wrap" }}>{coin.description}</p>
        </section>
      )}
    </main>
  );
}
