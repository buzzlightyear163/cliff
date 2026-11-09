import type { Elsewhere } from "../lib/api";

// One mark per recent LaunchLab launch. Filled = the dev bag was locked.
export default function Tally({ data }: { data: Elsewhere | null }) {
  if (!data || !data.total) {
    return (
      <div className="panel tally">
        <div className="tally-big">
          Most LaunchLab coins lock nothing.
          <span>Loading the latest launches from Raydium LaunchLab.</span>
        </div>
      </div>
    );
  }
  const locked = data.total - data.noLock;
  const marks = Array.from({ length: data.total }, (_, i) => i < locked);
  return (
    <div className="panel tally">
      <div className="tally-big num">
        {data.noLock} of the last {data.total}
        <span>
          LaunchLab launches handed the dev the whole bag on day one. {locked === 0 ? "Not one of them" : locked === 1 ? "Only one" : `Only ${locked}`} locked any of it.
        </span>
      </div>
      <div className="ticks" aria-hidden="true">
        {marks.map((l, i) => (
          <span key={i} className={`tick ${l ? "locked" : ""}`} />
        ))}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: "var(--sea)" }} />
          Dev bag locked
        </span>
        <span>
          <i style={{ boxShadow: "inset 0 0 0 1px var(--stone-3)" }} />
          Nothing locked
        </span>
      </div>
    </div>
  );
}
