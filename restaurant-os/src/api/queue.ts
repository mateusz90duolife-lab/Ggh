// Kolejka akcji wykonanych bez internetu. Dozwolone TYLKO: zgłoszenie braku i odhaczenie zadania.
// Wysyłka jest po kolei i idempotentna (client_id), a błędy są widoczne dla użytkownika.
import { ApiError, NetworkError } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { uuid } from '../lib/uuid.js';
import { getSession } from './auth.js';
import { rpc } from './db.js';

export type QueueItem =
  | {
      id: string;
      kind: 'report_shortage';
      createdAt: number;
      label: string;
      args: { p_product_id: string; p_quantity: number; p_urgent: boolean; p_note: string | null };
      error?: string;
    }
  | {
      id: string;
      kind: 'complete_task';
      createdAt: number;
      label: string;
      args: { p_task_id: string; p_done: boolean };
      error?: string;
    };

type NewItem =
  | {
      id?: string;
      kind: 'report_shortage';
      label: string;
      args: Extract<QueueItem, { kind: 'report_shortage' }>['args'];
    }
  | { id?: string; kind: 'complete_task'; label: string; args: Extract<QueueItem, { kind: 'complete_task' }>['args'] };

const listeners = new Set<() => void>();
export function onQueueChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((l) => l());

function key(): string | null {
  const s = getSession();
  return s ? `ros.queue.${s.user.id}` : null;
}

export function listQueue(): QueueItem[] {
  const k = key();
  return k ? storage.getJson<QueueItem[]>(k, []) : [];
}

function save(items: QueueItem[]): void {
  const k = key();
  if (!k) return;
  if (items.length === 0) storage.remove(k);
  else storage.setJson(k, items);
  notify();
}

export function enqueue(item: NewItem): QueueItem {
  const full = { ...item, id: item.id ?? uuid(), createdAt: Date.now() } as QueueItem;
  let items = listQueue();
  // wielokrotne odhaczenie/cofnięcie tego samego zadania offline: zostaje tylko ostatnia decyzja
  if (full.kind === 'complete_task') {
    items = items.filter((i) => !(i.kind === 'complete_task' && i.args.p_task_id === full.args.p_task_id));
  }
  items.push(full);
  save(items);
  return full;
}

export function removeFromQueue(id: string): void {
  save(listQueue().filter((i) => i.id !== id));
}

export function pendingCount(): number {
  return listQueue().filter((i) => !i.error).length;
}

export function failedItems(): QueueItem[] {
  return listQueue().filter((i) => i.error);
}

export function clearQueueForUser(userId: string): void {
  storage.remove(`ros.queue.${userId}`);
  notify();
}

async function send(item: QueueItem): Promise<void> {
  if (item.kind === 'report_shortage') await rpc('report_shortage', { ...item.args, p_client_id: item.id });
  else await rpc('complete_task', item.args);
}

let flushing: Promise<FlushResult> | null = null;
export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
}

/** Wysyła zakolejkowane akcje. Przy braku sieci/5xx zatrzymuje się i zostawia resztę na później. */
export function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let failed = 0;
    for (const item of listQueue()) {
      if (item.error) continue;
      try {
        await send(item);
        removeFromQueue(item.id);
        sent++;
      } catch (e) {
        if (e instanceof NetworkError) break;
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
