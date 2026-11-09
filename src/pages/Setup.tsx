import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { postJSON } from "../lib/api";
import { useSendTx, useSite } from "../lib/site";
import { WalletButton } from "../components/Chrome";

type Status = { platformId: string; platformExists: boolean; ruleExists: boolean };

// One-time admin page: creates CLIFF's own LaunchLab platform and turns on the on-chain lock rule.
export default function Setup() {
  const { publicKey } = useWallet();
  const { config } = useSite();
  const sendTx = useSendTx();
  const [status, setStatus] = useState<Status | null>(null);
  const [fee, setFee] = useState("0.5");
  const [creatorFee, setCreatorFee] = useState("0.3");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => publicKey && postJSON<Status>("/api/setup", { owner: publicKey.toBase58(), step: "status" }).then(setStatus).catch((e) => setMsg(e.message));
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  async function run(step: "platform" | "rules") {
    if (!publicKey) return;
    setBusy(step);
    setMsg(null);
    try {
      const b = await postJSON<{ tx: string }>("/api/setup", {
        owner: publicKey.toBase58(),
        step,
        feeRate: Number(fee) / 100,
        creatorFeeRate: Number(creatorFee) / 100,
        web: window.location.origin,
        img: `${window.location.origin}/mark-512.png`,
      });
      const sig = await sendTx(b.tx);
      setMsg(`Done: ${sig}`);
      await refresh();
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="wrap" style={{ padding: "40px 0 80px", maxWidth: 760 }}>
      <h1 style={{ margin: "0 0 8px" }}>Platform setup</h1>
      <p className="muted">
        Run once from the wallet that should own CLIFF's LaunchLab platform and receive its fees. Then set <span className="mono">PLATFORM_ADMIN</span> to that wallet in
        Vercel.
      </p>
      <p className="muted">Active platform now: {config?.platform ? `${config.platform.name} (${config.platform.own ? "own" : "Raydium default"})` : "loading"}</p>
      {!publicKey ? (
        <WalletButton />
      ) : (
        <>
          <div className="panel form-card">
            <h2>1. Create the platform</h2>
            <p className="hint">Platform id for this wallet: <span className="mono">{status?.platformId ?? "…"}</span></p>
            <div className="row">
              <div>
                <label className="field-label">Platform fee, %</label>
                <input className="input" value={fee} onChange={(e) => setFee(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Creator fee, %</label>
                <input className="input" value={creatorFee} onChange={(e) => setCreatorFee(e.target.value)} />
              </div>
            </div>
            <button className="btn" disabled={!!busy || !status || status.platformExists} onClick={() => run("platform")}>
              {status?.platformExists ? "Platform exists" : busy === "platform" ? "Creating…" : "Create platform"}
            </button>
          </div>
          <div className="panel form-card">
            <h2>2. Enforce the lock on chain</h2>
            <p className="hint">Writes the rule (lock 5–20%, cliff 7 days or more, release 30 days or more) and makes the program reject launches that don't meet it.</p>
            <button className="btn" disabled={!!busy || !status?.platformExists} onClick={() => run("rules")}>
              {busy === "rules" ? "Writing…" : status?.ruleExists ? "Rewrite rule and enforce" : "Write rule and enforce"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="note mono" style={{ wordBreak: "break-all" }}>{msg}</p>}
    </main>
  );
}
