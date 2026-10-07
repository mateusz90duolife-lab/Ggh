// Prosty stan „czy mamy połączenie z serwerem” + powiadamianie UI (baner trybu offline).
export interface NetState {
  offline: boolean;
  /** Czas (ms), z którego pochodzą dane wyświetlane z pamięci podręcznej; null = dane na żywo. */
  staleSince: number | null;
}

let state: NetState = { offline: false, staleSince: null };
const listeners = new Set<(s: NetState) => void>();

export function getNet(): NetState {
  return state;
}

export function onNet(fn: (s: NetState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function set(next: NetState) {
  if (next.offline === state.offline && next.staleSince === state.staleSince) return;
  state = next;
  for (const l of listeners) l(state);
}

export function markOnline(): void {
  set({ offline: false, staleSince: null });
}

export function markOffline(staleSince?: number): void {
  set({ offline: true, staleSince: staleSince ?? state.staleSince });
}

export function markStale(at: number): void {
  set({ offline: true, staleSince: state.staleSince === null ? at : Math.min(state.staleSince, at) });
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => markOffline());
  window.addEventListener('online', () => set({ offline: false, staleSince: state.staleSince }));
}
