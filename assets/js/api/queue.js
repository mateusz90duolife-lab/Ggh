// Kolejka akcji wykonanych bez internetu. Dozwolone TYLKO: zgłoszenie braku i odhaczenie zadania.
// Wysyłka jest po kolei i idempotentna (client_id), a błędy są widoczne dla użytkownika.
import { ApiError, NetworkError } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { uuid } from '../lib/uuid.js';
import { getSession } from './auth.js';
import { rpc } from './db.js';
const listeners = new Set();
export function onQueueChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((l) => l());
function key() {
    const s = getSession();
    return s ? `ros.queue.${s.user.id}` : null;
}
export function listQueue() {
    const k = key();
    return k ? storage.getJson(k, []) : [];
}
function save(items) {
    const k = key();
    if (!k)
        return;
    if (items.length === 0)
        storage.remove(k);
    else
        storage.setJson(k, items);
    notify();
}
export function enqueue(item) {
    const full = { ...item, id: item.id ?? uuid(), createdAt: Date.now() };
    let items = listQueue();
    // wielokrotne odhaczenie/cofnięcie tego samego zadania offline: zostaje tylko ostatnia decyzja
    if (full.kind === 'complete_task') {
        items = items.filter((i) => !(i.kind === 'complete_task' && i.args.p_task_id === full.args.p_task_id));
    }
    items.push(full);
    save(items);
    return full;
}
export function removeFromQueue(id) {
    save(listQueue().filter((i) => i.id !== id));
}
export function pendingCount() {
    return listQueue().filter((i) => !i.error).length;
}
export function failedItems() {
    return listQueue().filter((i) => i.error);
}
export function clearQueueForUser(userId) {
    storage.remove(`ros.queue.${userId}`);
    notify();
}
async function send(item) {
    if (item.kind === 'report_shortage')
        await rpc('report_shortage', { ...item.args, p_client_id: item.id });
    else
        await rpc('complete_task', item.args);
}
let flushing = null;
/** Wysyła zakolejkowane akcje. Przy braku sieci/5xx zatrzymuje się i zostawia resztę na później. */
export function flushQueue() {
    if (flushing)
        return flushing;
    flushing = (async () => {
        let sent = 0;
        let failed = 0;
        for (const item of listQueue()) {
            if (item.error)
                continue;
            try {
                await send(item);
                removeFromQueue(item.id);
                sent++;
            }
            catch (e) {
                if (e instanceof NetworkError)
                    break;
                if (e instanceof ApiError && (e.status >= 500 || e.status === 401 || e.status === 408 || e.status === 429))
                    break;
                const msg = e instanceof ApiError ? e.message : 'Nie udało się wysłać.';
                save(listQueue().map((i) => (i.id === item.id ? { ...i, error: msg } : i)));
                failed++;
            }
        }
        return { sent, failed, remaining: pendingCount() };
    })().finally(() => {
        flushing = null;
    });
    return flushing;
}
