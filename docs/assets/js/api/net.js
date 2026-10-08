let state = { offline: false, staleSince: null };
const listeners = new Set();
export function getNet() {
    return state;
}
export function onNet(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function set(next) {
    if (next.offline === state.offline && next.staleSince === state.staleSince)
        return;
    state = next;
    for (const l of listeners)
        l(state);
}
export function markOnline() {
    set({ offline: false, staleSince: null });
}
export function markOffline(staleSince) {
    set({ offline: true, staleSince: staleSince ?? state.staleSince });
}
export function markStale(at) {
    set({ offline: true, staleSince: state.staleSince === null ? at : Math.min(state.staleSince, at) });
}
if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => markOffline());
    window.addEventListener('online', () => set({ offline: false, staleSince: state.staleSince }));
}
