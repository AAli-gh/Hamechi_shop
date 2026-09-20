import { useEffect, useState } from "react";

/**
 * The compare list is a per-visitor convenience, so it lives in localStorage
 * rather than on the server. A custom event keeps every component in sync.
 */
const KEY = "compare_products";
const EVENT = "compare-change";
export const MAX_COMPARE = 4;

function read(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id) => Number.isInteger(id)).slice(0, MAX_COMPARE) : [];
  } catch {
    return []; // private mode or blocked storage
  }
}

function write(ids: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Not being able to remember the list is not worth an error.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useCompare() {
  const [ids, setIds] = useState<number[]>(read);

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // other tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    ids,
    isFull: ids.length >= MAX_COMPARE,
    has: (id: number) => ids.includes(id),
    /** Returns false when the list is full and the product was not added. */
    toggle: (id: number): boolean => {
      const current = read();
      if (current.includes(id)) {
        write(current.filter((x) => x !== id));
        return true;
      }
      if (current.length >= MAX_COMPARE) return false;
      write([...current, id]);
      return true;
    },
    remove: (id: number) => write(read().filter((x) => x !== id)),
    clear: () => write([]),
  };
}
