import { useState } from "react";
import { Link } from "react-router-dom";
import CrossSection from "../components/CrossSection";
import CoinTable from "../components/CoinTable";
import Tally from "../components/Tally";
import { Seg } from "../components/Chrome";
import { CLIFF_OPTIONS, LOCK_OPTIONS, UNLOCK_OPTIONS } from "../../shared/curve";
import { useBoard } from "../lib/board";

export default function Home() {
  const [lock, setLock] = useState(0.1);
  const [cliff, setCliff] = useState(30);
  const [unlock, setUnlock] = useState(90);
  const { board } = useBoard();
  const q = `?lock=${lock}&cliff=${cliff}&release=${unlock}`;

  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <h1>
              The dev's
              <br />
              bag waits.
            </h1>
            <div>
              <p className="lede">
                Every launchpad hands the dev the whole bag the second the coin exists. On CLIFF it is locked inside Raydium's own program: nothing unlocks until
                the coin graduates, then the cliff runs, then it drips out where everyone can watch.
              </p>
              <div className="hero-actions">
                <Link className="btn" to={`/launch${q}`}>
                  Launch a coin
                </Link>
                <Link className="btn ghost" to="/board">
                  See locked coins
                </Link>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-head">
              <h2>Shape the lock</h2>
              <span className="sum">
                {Math.round(lock * 100)}% of supply, untouchable through the curve and {cliff} days after graduation, then released over {unlock} days.
              </span>
            </div>
            <CrossSection lockRate={lock} cliffDays={cliff} unlockDays={unlock} intro />
            <div className="controls">
              <div className="control">
                <label>Dev bag</label>
                <Seg label="Dev bag" options={LOCK_OPTIONS} value={lock} onChange={setLock} format={(v) => `${Math.round(v * 100)}%`} />
              </div>
              <div className="control">
                <label>Cliff after graduation</label>
                <Seg label="Cliff" options={CLIFF_OPTIONS} value={cliff} onChange={setCliff} format={(v) => `${v}d`} />
              </div>
              <div className="control">
                <label>Release</label>
                <Seg label="Release" options={UNLOCK_OPTIONS} value={unlock} onChange={setUnlock} format={(v) => `${v}d`} />
              </div>
              <div className="control control-cta">
                <Link className="btn" to={`/launch${q}`}>
                  Launch with this lock
                </Link>
              </div>
            </div>
            <div className="steps">
              <div className="step">
                <h3>
                  <span className="n">1</span>Launch
                </h3>
                <p>The coin is created on Raydium LaunchLab and the dev bag is locked in the same transaction.</p>
              </div>
              <div className="step">
                <h3>
                  <span className="n">2</span>Curve
                </h3>
                <p>The coin trades on its bonding curve. The locked bag can't move, whatever the chart does.</p>
              </div>
              <div className="step">
                <h3>
                  <span className="n">3</span>Graduation
                </h3>
                <p>Liquidity moves to a Raydium pool and the program starts the cliff clock on chain.</p>
              </div>
              <div className="step">
                <h3>
                  <span className="n">4</span>Release
                </h3>
                <p>After the cliff the bag unlocks a little every second until the release ends.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <h2>Locked right now</h2>
              <p className="sub">Every coin launched on CLIFF, with the dev bag and when it can first move.</p>
            </div>
            <Link className="btn ghost small" to="/board">
              Open the board
            </Link>
          </div>
          <div className="panel">
            {board && board.coins.length > 0 ? (
              <CoinTable coins={board.coins} limit={6} />
            ) : (
              <div className="empty">
                <b>{board ? "No coins yet." : "Loading the board."}</b> {board && "The first launch on CLIFF shows up here the moment it confirms."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <div>
              <h2>Elsewhere on LaunchLab</h2>
              <p className="sub">The newest coins on Raydium LaunchLab, read straight from Raydium's launch index.</p>
            </div>
          </div>
          <Tally data={board?.elsewhere ?? null} />
        </div>
      </section>
    </main>
  );
}
