// Wspólne operacje na danych używane przez kilka ekranów.
import { eq, inList, list, rpc } from './api/db.js';
import { enqueue, listQueue } from './api/queue.js';
import { isNetworkError } from './lib/errors.js';
import type { Shortage, Task } from './types.js';

export const TASK_COLUMNS = 'id,title,description,due_date,status,assigned_to,done_by,done_at,template_id,created_at';

/** Dzisiejsze zadania. Najpierw (best effort) dogenerowujemy zadania z szablonów — zabezpieczenie na wypadek braku crona. */
export async function loadTodayTasks(date: string): Promise<Task[]> {
  try {
    await rpc('ensure_today_tasks');
  } catch {
    /* brak sieci/uprawnień nie może blokować listy */
  }
  return list<Task>('tasks', {
    select: TASK_COLUMNS,
    params: { due_date: eq(date) },
    order: 'status.asc,created_at.asc',
  });
}

export function pendingTaskIds(): Set<string> {
  return new Set(
    listQueue()
      .filter((i) => i.kind === 'complete_task')
      .map((i) => (i.kind === 'complete_task' ? i.args.p_task_id : '')),
  );
}

/**
 * Odhaczenie zadania. Zwraca zaktualizowany wiersz albo null, gdy akcja została zakolejkowana (brak internetu).
 * Błędy serwera (np. brak uprawnień) są rzucane dalej.
 */
export async function setTaskDone(task: Task, done: boolean): Promise<Task | null> {
  try {
    return await rpc<Task>('complete_task', { p_task_id: task.id, p_done: done });
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue({ kind: 'complete_task', label: task.title, args: { p_task_id: task.id, p_done: done } });
      return null;
    }
    throw e;
  }
}

export async function loadOpenShortages(limit = 100): Promise<Shortage[]> {
  return list<Shortage>('shortages', {
    select: 'id,product_id,quantity,unit,urgent,note,status,reported_by,created_at',
    params: { status: eq('open') },
    order: 'created_at.desc',
    limit,
  });
}

/** Ile razy każdy produkt był zgłaszany (do sortowania podpowiedzi). */
export async function shortageFrequency(): Promise<Map<string, number>> {
  const rows = await list<{ product_id: string }>('shortages', {
    select: 'product_id',
    order: 'created_at.desc',
    limit: 300,
  });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1);
  return m;
}

export async function productsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return list<{ id: string; name: string; unit: string }>('products', {
    select: 'id,name,unit',
    params: { id: inList(ids) },
  });
}
