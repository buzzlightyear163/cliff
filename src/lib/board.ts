import { useEffect, useState } from "react";
import { getJSON, type Board } from "./api";

let last: Board | null = null;

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(last);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getJSON<Board>("/api/coins")
        .then((b) => {
          if (!b || !Array.isArray(b.coins)) throw new Error("The board returned no data.");
          last = b;
          if (alive) {
            setBoard(b);
            setError(null);
          }
        })
        .catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return { board, error };
}
