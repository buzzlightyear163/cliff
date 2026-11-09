import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import CrossSection from "../components/CrossSection";
import { Seg } from "../components/Chrome";
import { CLIFF_OPTIONS, CURVE_PRESETS, LL, LOCK_OPTIONS, UNLOCK_OPTIONS, planLaunch } from "../../shared/curve";
import { postJSON } from "../lib/api";
import { useSendTx, useSite } from "../lib/site";
import { pct, sol, tokens, usd } from "../lib/format";

type Stage = "idle" | "upload" | "build" | "sign" | "send" | "confirm" | "register";
const STAGES: { id: Stage; label: string }[] = [
  { id: "upload", label: "Upload image and details" },
  { id: "build", label: "Build the launch" },
  { id: "sign", label: "Sign in your wallet" },
  { id: "send", label: "Send to Solana" },
  { id: "confirm", label: "Confirm on chain" },
  { id: "register", label: "Add to the board" },
];

function pick<T extends number>(raw: string | null, options: T[], fallback: T): T {
  const n = Number(raw);
  return (options.find((o) => Math.abs(o - n) < 1e-9) ?? fallback) as T;
}

async function readImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (file.type === "image/gif" && file.size < 1_400_000) return dataUrl;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const s = Math.max(size / img.width, size / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const png = c.toDataURL("image/png");
  return png.length < 1_900_000 ? png : c.toDataURL("image/jpeg", 0.9);
}

export default function Launch() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { config, solUsd, openWallet, toast } = useSite();
  const { publicKey } = useWallet();
  const sendTx = useSendTx();

  const [lock, setLock] = useState(() => pick(params.get("lock"), LOCK_OPTIONS, 0.1));
  const [cliff, setCliff] = useState(() => pick(params.get("cliff"), CLIFF_OPTIONS, 30));
  const [release, setRelease] = useState(() => pick(params.get("release"), UNLOCK_OPTIONS, 90));
  const [preset, setPreset] = useState<string>("default");
  const [startUsd, setStartUsd] = useState(12_000);
  const [gradUsd, setGradUsd] = useState(90_000);

  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [devBuy, setDevBuy] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startMcSol = preset === "default" ? LL.defaultStartMcSol : startUsd / solUsd;
  const gradMcSol = preset === "default" ? LL.defaultGradMcSol : gradUsd / solUsd;
  const plan = useMemo(() => planLaunch({ startMcSol, gradMcSol, lockRate: lock }), [startMcSol, gradMcSol, lock]);
  const devBuySol = Math.max(0, Number(devBuy) || 0);
  const maxDevBuy = plan.raiseSol / 2;
  const platform = config?.platform;
  const tradeFee = (config?.protocolFee ?? 0.0025) + (platform?.feeRate ?? 0.0075) + (platform?.creatorFeeRate ?? 0.0005);

  const problems: string[] = [...plan.errors];
  if (devBuySol > maxDevBuy) problems.push(`Dev buy can be at most ${maxDevBuy.toFixed(1)} SOL on this curve.`);
  const missing = !image ? "Add an image." : !name.trim() ? "Add a name." : !symbol.trim() ? "Add a ticker." : null;
  const busy = stage !== "idle";

  function choosePreset(id: string) {
    setPreset(id);
    const p = CURVE_PRESETS.find((x) => x.id === id);
    if (p?.startUsd && p.gradUsd) {
      setStartUsd(p.startUsd);
      setGradUsd(p.gradUsd);
    }
  }

  async function launch() {
    if (!publicKey) return openWallet();
    if (missing || problems.length) return setError(missing || problems[0]);
    setError(null);
    try {
      setStage("upload");
      const up = await postJSON<{ uri: string }>("/api/upload", { name, symbol, description, website, twitter, telegram, image });
      setStage("build");
      const built = await postJSON<{ tx: string; mint: string }>("/api/build-launch", {
        owner: publicKey.toBase58(),
        name,
        symbol,
        uri: up.uri,
        startMcSol,
        gradMcSol,
        lockRate: lock,
        cliffDays: cliff,
        unlockDays: release,
        devBuySol,
      });
      await sendTx(built.tx, (s) => setStage(s));
      setStage("register");
      await postJSON("/api/register", { mint: built.mint }).catch(() => toast("Launched. The board will pick it up shortly."));
      nav(`/c/${built.mint}?new=1`);
    } catch (e: any) {
      const m = String(e?.message || e);
      setError(/User rejected|rejected the request/i.test(m) ? "You cancelled the signature. Nothing was launched." : m);
      setStage("idle");
    }
  }

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <main className="wrap">
      <div className="launch-grid">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(34px,4.5vw,52px)", lineHeight: 1, fontWeight: 850, fontVariationSettings: '"wdth" 115', letterSpacing: "-0.03em" }}>
            Launch a coin
          </h1>
          <p className="muted" style={{ margin: "0 0 24px", maxWidth: "58ch" }}>
            The coin goes live on Raydium LaunchLab with your dev bag locked in the same transaction. You can't sell it on the curve, and neither can anyone else.
          </p>

          <section className="panel form-card">
            <h2>
              <span className="n">1</span>The lock
            </h2>
            <p className="hint">How much of the supply is your bag, how long it waits after graduation, and how slowly it comes out.</p>
            <div className="row three">
              <div>
                <span className="field-label">Dev bag</span>
                <Seg label="Dev bag" options={LOCK_OPTIONS} value={lock} onChange={setLock} format={(v) => `${Math.round(v * 100)}%`} />
              </div>
              <div>
                <span className="field-label">Cliff after graduation</span>
                <Seg label="Cliff" options={CLIFF_OPTIONS} value={cliff} onChange={setCliff} format={(v) => `${v}d`} />
              </div>
              <div>
                <span className="field-label">Release</span>
                <Seg label="Release" options={UNLOCK_OPTIONS} value={release} onChange={setRelease} format={(v) => `${v}d`} />
              </div>
            </div>
            <p className="note">
              {tokens(plan.lockTokens)} tokens are locked to your wallet. If the coin never graduates, they never unlock.
            </p>
          </section>

          <section className="panel form-card">
            <h2>
              <span className="n">2</span>The coin
            </h2>
            <p className="hint">This is what traders see on LaunchLab, Raydium and every terminal.</p>
            <div className="coin-row">
              <div>
                <span className="field-label">Image</span>
                <div className="img-drop" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}>
                  {image ? <img src={image} alt="Coin" /> : "Add image"}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setImage(await readImage(f).catch(() => null));
                  }}
                />
              </div>
              <div>
                <div className="row">
                  <div>
                    <label className="field-label" htmlFor="name">Name</label>
                    <input id="name" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="sym">Ticker</label>
                    <div className="input-affix">
                      <span>$</span>
                      <input id="sym" className="input" maxLength={10} value={symbol} onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())} />
                    </div>
                  </div>
                </div>
                <div className="row one">
                  <div>
                    <label className="field-label" htmlFor="desc">Description</label>
                    <textarea id="desc" className="input" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="row three">
              <div>
                <label className="field-label" htmlFor="x">X</label>
                <input id="x" className="input" placeholder="https://x.com/…" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="web">Website</label>
                <input id="web" className="input" placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="tg">Telegram</label>
                <input id="tg" className="input" placeholder="https://t.me/…" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="panel form-card">
            <h2>
              <span className="n">3</span>The curve
            </h2>
            <p className="hint">Where the coin starts and where it graduates to a Raydium pool. Shown in dollars, set in SOL at launch.</p>
            <div className="presets">
              {CURVE_PRESETS.map((p) => (
                <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => choosePreset(p.id)} title={p.note}>
                  {p.name}
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>
                Custom
              </button>
            </div>
            {preset !== "default" && (
              <div className="row">
                <div>
                  <label className="field-label" htmlFor="start">Starts at</label>
                  <div className="input-affix">
                    <span>$</span>
                    <input id="start" className="input num" inputMode="numeric" value={startUsd} onChange={(e) => { setPreset("custom"); setStartUsd(Number(e.target.value.replace(/\D/g, "")) || 0); }} />
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="grad">Graduates at</label>
                  <div className="input-affix">
                    <span>$</span>
                    <input id="grad" className="input num" inputMode="numeric" value={gradUsd} onChange={(e) => { setPreset("custom"); setGradUsd(Number(e.target.value.replace(/\D/g, "")) || 0); }} />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel form-card">
            <h2>
              <span className="n">4</span>Dev buy
            </h2>
            <p className="hint">Optional. You buy first, in the same transaction, at the start price. These tokens are not locked and show as yours on chain.</p>
            <div className="row">
              <div className="input-affix">
                <input className="input num" style={{ paddingLeft: 13 }} inputMode="decimal" placeholder="0" value={devBuy} onChange={(e) => setDevBuy(e.target.value.replace(/[^0-9.]/g, ""))} />
                <span className="after">SOL</span>
              </div>
              <div className="note" style={{ alignSelf: "center", marginTop: 0 }}>
                Max {maxDevBuy.toFixed(1)} SOL on this curve
              </div>
            </div>
          </section>
        </div>

        <aside className="panel summary" aria-label="Launch summary">
          <div className="xsec-wrap">
            <CrossSection lockRate={lock} cliffDays={cliff} unlockDays={release} compact />
          </div>
          <dl className="kv">
            <dt>Starts at</dt>
            <dd>{usd(startMcSol * solUsd)} <span className="faint">{sol(startMcSol)}</span></dd>
            <dt>Graduates at</dt>
            <dd>{usd(gradMcSol * solUsd)} <span className="faint">{sol(gradMcSol)}</span></dd>
            <dt>Raises before graduating</dt>
            <dd>{sol(plan.raiseSol)}</dd>
            <dt>Sold on the curve</dt>
            <dd>{pct(plan.soldRate, 1)}</dd>
            <dt>Dev bag, locked</dt>
            <dd>{pct(lock)} <span className="faint">{tokens(plan.lockTokens)}</span></dd>
            <dt>Goes to the pool</dt>
            <dd>{pct(plan.poolRate, 1)} + the raise</dd>
            <dt>Unlock starts</dt>
            <dd>{cliff} days after graduation</dd>
            <dt>Fully released</dt>
            <dd>{cliff + release} days after graduation</dd>
            <dt>Trading fee on the curve</dt>
            <dd>{pct(tradeFee, 2)}</dd>
            {devBuySol > 0 && (
              <>
                <dt>Dev buy</dt>
                <dd>{sol(devBuySol, 2)}</dd>
              </>
            )}
          </dl>
          {busy && (
            <div className="progress">
              <ol>
                {STAGES.map((s, i) => (
                  <li key={s.id} className={i < stageIndex ? "done" : i === stageIndex ? "on" : ""}>
                    <span className="dot" />
                    {s.label}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="go">
            <button className="btn wide" onClick={launch} disabled={busy || (!!publicKey && (!!missing || problems.length > 0))}>
              {!publicKey ? "Connect wallet to launch" : busy ? "Launching…" : `Launch ${symbol ? "$" + symbol : "coin"} with this lock`}
            </button>
            {(error || (publicKey && (problems[0] || missing))) && <div className="errors">{error || problems[0] || missing}</div>}
            <p className="note">Your wallet signs one transaction. Network fees are about 0.02 SOL{devBuySol > 0 ? " plus your dev buy" : ""}.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
