import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider as CP, WalletProvider as WP, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { getJSON, postJSON, type SiteConfig } from "./api";

const FALLBACK_SOL = 150;
// wallet-adapter ships React 19 types; cast to keep this React 18 project type-clean.
const ConnectionProvider = CP as unknown as (p: { endpoint: string; children: ReactNode }) => JSX.Element;
const WalletProvider = WP as unknown as (p: { wallets: never[]; autoConnect?: boolean; children: ReactNode }) => JSX.Element;

type Site = {
  config: SiteConfig | null;
  solUsd: number;
  openWallet: () => void;
  toast: (msg: string) => void;
};

const Ctx = createContext<Site>({ config: null, solUsd: FALLBACK_SOL, openWallet: () => {}, toast: () => {} });
export const useSite = () => useContext(Ctx);

export function SiteProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      <WalletProvider wallets={[]} autoConnect>
        <Inner>{children}</Inner>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function Inner({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => getJSON<SiteConfig>("/api/config").then((c) => alive && setConfig(c)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 3200);
  }, []);

  const value = useMemo<Site>(
    () => ({ config, solUsd: config?.solUsd || FALLBACK_SOL, openWallet: () => setWalletOpen(true), toast }),
    [config, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const { wallets, select, connect, wallet, connected } = useWallet();
  const ready = wallets.filter((w) => w.readyState === "Installed" || w.readyState === "Loadable");

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  useEffect(() => {
    if (wallet && !connected) connect().catch(() => {});
  }, [wallet, connected, connect]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={(e) => e.stopPropagation()}>
        <h3>Connect a wallet</h3>
        {ready.length === 0 && (
          <p className="muted" style={{ marginTop: 0 }}>
            No Solana wallet found in this browser. Install{" "}
            <a href="https://phantom.com" target="_blank" rel="noreferrer">
              Phantom
            </a>{" "}
            or another Solana wallet, then reload.
          </p>
        )}
        {ready.map((w) => (
          <button key={w.adapter.name} className="wallet-btn" onClick={() => select(w.adapter.name)}>
            <img src={w.adapter.icon} alt="" />
            {w.adapter.name}
          </button>
        ))}
        <button className="btn ghost small" style={{ marginTop: 6 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// Signs a transaction the server built, sends it through our RPC and waits for confirmation.
export function useSendTx() {
  const { signTransaction, sendTransaction, publicKey } = useWallet();
  return useCallback(
    async (b64: string, onStage?: (s: "sign" | "send" | "confirm") => void) => {
      if (!publicKey) throw new Error("Connect a wallet first.");
      const tx = VersionedTransaction.deserialize(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      onStage?.("sign");
      let sig: string;
      if (signTransaction) {
        const signed = await signTransaction(tx);
        onStage?.("send");
        const bytes = signed.serialize();
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        sig = (await postJSON<{ sig: string }>("/api/send", { tx: btoa(bin) })).sig;
      } else {
        const { Connection } = await import("@solana/web3.js");
        sig = await sendTransaction(tx, new Connection("https://api.mainnet-beta.solana.com"));
        onStage?.("send");
      }
      onStage?.("confirm");
      const started = Date.now();
      while (Date.now() - started < 75_000) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await getJSON<{ confirmed: boolean; failed: boolean; err: unknown }>(`/api/status?sig=${sig}`).catch(() => null);
        if (st?.failed) throw new Error(`Transaction failed on chain: ${JSON.stringify(st.err)}`);
        if (st?.confirmed) return sig;
      }
      throw new Error(`Not confirmed yet. Check the transaction on Solscan: ${sig}`);
    },
    [signTransaction, sendTransaction, publicKey],
  );
}
