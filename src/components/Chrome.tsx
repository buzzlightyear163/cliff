import { NavLink, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSite } from "../lib/site";
import { short, usd } from "../lib/format";

export function Mark({ size = 28, color = "var(--ink)", accent = "var(--accent)" }: { size?: number; color?: string; accent?: string }) {
  // Pixel padlock. The blue steps inside are the release: flat while locked, then stepping down.
  return (
    <svg width={size} height={size} viewBox="1.5 -1.5 13 16" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="5" y="0" width="6" height="1" fill={color}/><rect x="4" y="1" width="2" height="1" fill={color}/><rect x="10" y="1" width="2" height="1" fill={color}/><rect x="4" y="2" width="1" height="1" fill={color}/><rect x="11" y="2" width="1" height="1" fill={color}/><rect x="4" y="3" width="1" height="1" fill={color}/><rect x="11" y="3" width="1" height="1" fill={color}/><rect x="4" y="4" width="1" height="1" fill={color}/><rect x="11" y="4" width="1" height="1" fill={color}/><rect x="2" y="5" width="12" height="1" fill={color}/><rect x="2" y="6" width="12" height="1" fill={color}/><rect x="2" y="7" width="2" height="1" fill={color}/><rect x="9" y="7" width="5" height="1" fill={color}/><rect x="2" y="8" width="2" height="1" fill={color}/><rect x="10" y="8" width="4" height="1" fill={color}/><rect x="2" y="9" width="2" height="1" fill={color}/><rect x="11" y="9" width="3" height="1" fill={color}/><rect x="2" y="10" width="2" height="1" fill={color}/><rect x="12" y="10" width="2" height="1" fill={color}/><rect x="2" y="11" width="12" height="1" fill={color}/><rect x="2" y="12" width="12" height="1" fill={color}/><rect x="4" y="7" width="5" height="1" fill={accent}/><rect x="4" y="8" width="6" height="1" fill={accent}/><rect x="4" y="9" width="7" height="1" fill={accent}/><rect x="4" y="10" width="8" height="1" fill={accent}/>
    </svg>
  );
}

export function WalletButton({ small }: { small?: boolean }) {
  const { publicKey, disconnect } = useWallet();
  const { openWallet } = useSite();
  if (publicKey)
    return (
      <button className={`btn ghost ${small ? "small" : ""}`} onClick={() => disconnect()} title="Disconnect">
        {short(publicKey.toBase58())}
      </button>
    );
  return (
    <button className={`btn ${small ? "small" : ""}`} onClick={openWallet}>
      Connect wallet
    </button>
  );
}

export function CopyCA({ ca }: { ca: string }) {
  const { toast } = useSite();
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(ca);
        toast("Contract address copied");
      }}
    >
      copy
    </button>
  );
}

export function Header() {
  const { config, solUsd } = useSite();
  const links = (
    <>
      <NavLink to="/board">Board</NavLink>
      <NavLink to="/launch">Launch</NavLink>
      <NavLink to="/docs">Docs</NavLink>
      {config?.x && (
        <a href={config.x} target="_blank" rel="noreferrer">
          X
        </a>
      )}
    </>
  );
  return (
    <>
      {config?.ca && (
        <div className="live-strip">
          <div className="wrap">
            <span>
              <b>$CLIFF</b> is live
            </span>
            <span className="mono">{short(config.ca, 5)}</span>
            <CopyCA ca={config.ca} />
            <a href={`https://raydium.io/launchpad/token/?mint=${config.ca}`} target="_blank" rel="noreferrer">
              Buy
            </a>
            <a href={`https://dexscreener.com/solana/${config.ca}`} target="_blank" rel="noreferrer">
              Chart
            </a>
          </div>
        </div>
      )}
      <header className="header">
        <div className="wrap">
          <Link to="/" className="brand" aria-label="CLIFF home">
            <Mark />
            <span className="brand-word">CLIFF</span>
          </Link>
          <nav className="nav">{links}</nav>
          <div className="header-right">
            {config && <span className="sol-chip num">SOL {usd(solUsd, { exact: true })}</span>}
            <WalletButton small />
          </div>
        </div>
        <div className="wrap mobile-only">
          <nav className="nav mobile">{links}</nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const { config } = useSite();
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink)" }}>
            <Mark size={20} />
            <b style={{ fontVariationSettings: '"wdth" 125', fontWeight: 900 }}>CLIFF</b>
          </div>
          <p style={{ margin: "10px 0 0", maxWidth: "52ch" }}>
            Launches run on Raydium LaunchLab. Your wallet signs every transaction. Memecoins are risky and a locked dev bag does not make a coin good.
          </p>
        </div>
        <nav>
          <Link to="/board">Board</Link>
          <Link to="/launch">Launch</Link>
          <Link to="/docs">Docs</Link>
          {config?.x && (
            <a href={config.x} target="_blank" rel="noreferrer">
              X
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

export function Seg<T extends number | string>({
  options,
  value,
  onChange,
  format,
  label,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {format(o)}
        </button>
      ))}
    </div>
  );
}
