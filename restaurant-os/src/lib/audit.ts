import { formatQty } from './format.js';
import { unitLabel } from './units.js';

export interface AuditEntry {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface AuditLookups {
  productName(id: string): string;
  productUnit(id: string): string;
  userName(id: string): string;
}

const MOVE_LABEL: Record<string, string> = {
  purchase: 'zakup',
  consumption: 'zużycie',
  waste: 'odpad',
  adjustment: 'korekta',
  count_correction: 'korekta z inwentaryzacji',
};
const ROLE_LABEL: Record<string, string> = { owner: 'właściciel', manager: 'manager', employee: 'pracownik' };
const SHORTAGE_STATUS: Record<string, string> = { open: 'otwarte', resolved: 'zrealizowane', cancelled: 'anulowane' };

export const AUDIT_TABLES: { value: string; label: string }[] = [
  { value: 'inventory_movements', label: 'Ruchy magazynowe' },
  { value: 'products', label: 'Produkty' },
  { value: 'shortages', label: 'Braki' },
  { value: 'tasks', label: 'Zadania' },
  { value: 'task_templates', label: 'Szablony zadań' },
  { value: 'purchases', label: 'Zakupy' },
  { value: 'suppliers', label: 'Dostawcy' },
  { value: 'product_categories', label: 'Kategorie' },
  { value: 'profiles', label: 'Użytkownicy' },
  { value: 'restaurants', label: 'Ustawienia lokalu' },
];

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const signed = (v: unknown): string => {
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${formatQty(n)}`;
};

function changed(o: Record<string, unknown> | null, n: Record<string, unknown> | null, keys: string[]): string[] {
  return keys.filter((k) => JSON.stringify(o?.[k]) !== JSON.stringify(n?.[k]));
}

/**
 * Czytelny opis zmiany (strona bierna — bez zgadywania płci osób): „Zgłoszono brak: Mleko — 10 L”.
 * Autor zmiany jest pokazywany osobno przez wywołującego.
 */
export function describeAudit(e: AuditEntry, l: AuditLookups): string {
  const n = e.new_data;
  const o = e.old_data;
  const d = n ?? o ?? {};
  switch (e.table_name) {
    case 'inventory_movements': {
      const pid = str(d.product_id);
      return `Zapisano ruch (${MOVE_LABEL[str(d.type)] ?? str(d.type)}): ${l.productName(pid)} ${signed(d.quantity_delta)} ${unitLabel(l.productUnit(pid))}${d.note ? ` — ${str(d.note)}` : ''}`;
    }
    case 'shortages': {
      const pid = str(d.product_id);
      const what = `${l.productName(pid)} — ${formatQty(str(d.quantity))} ${unitLabel(str(d.unit))}`;
      if (e.action === 'INSERT') return `Zgłoszono brak: ${what}${d.urgent ? ' (PILNE)' : ''}`;
      if (e.action === 'UPDATE' && o?.status !== n?.status)
        return `Zmieniono status zgłoszenia „${what}” na: ${SHORTAGE_STATUS[str(n?.status)] ?? str(n?.status)}`;
      return `Zmieniono zgłoszenie braku: ${what}`;
    }
    case 'tasks': {
      const t = `„${str(d.title)}”`;
      if (e.action === 'INSERT') return `Dodano zadanie ${t}`;
      if (e.action === 'DELETE') return `Usunięto zadanie ${t}`;
      if (o?.status !== n?.status)
        return n?.status === 'done' ? `Wykonano zadanie ${t}` : `Cofnięto wykonanie zadania ${t}`;
      return `Zmieniono zadanie ${t}`;
    }
    case 'task_templates': {
      const t = `„${str(d.title)}”`;
      return e.action === 'INSERT'
        ? `Dodano szablon zadania ${t}`
        : e.action === 'DELETE'
          ? `Usunięto szablon zadania ${t}`
          : `Zmieniono szablon zadania ${t}`;
    }
    case 'products': {
      const t = `„${str(d.name)}”`;
      if (e.action === 'INSERT') return `Dodano produkt ${t}`;
      if (e.action === 'DELETE') return `Usunięto produkt ${t}`;
      const ch = changed(o, n, ['name', 'minimum_stock', 'active', 'category_id']);
      const parts = ch.map((k) =>
        k === 'name'
          ? `nazwa: ${str(o?.name)} → ${str(n?.name)}`
          : k === 'minimum_stock'
            ? `minimum: ${formatQty(str(o?.minimum_stock))} → ${formatQty(str(n?.minimum_stock))}`
            : k === 'active'
              ? n?.active
                ? 'aktywowano'
                : 'dezaktywowano'
              : 'zmieniono kategorię',
      );
      return `Zmieniono produkt ${t}${parts.length ? ` (${parts.join('; ')})` : ''}`;
    }
    case 'purchases': {
      const doc = d.document_number ? ` ${str(d.document_number)}` : '';
      if (e.action === 'INSERT') return `Utworzono zakup${doc}`;
      if (o?.status !== n?.status)
        return n?.status === 'confirmed'
          ? `Zatwierdzono zakup${doc}`
          : n?.status === 'cancelled'
            ? `Anulowano zakup${doc}`
            : `Zmieniono zakup${doc}`;
      return `Zmieniono zakup${doc}`;
    }
    case 'purchase_items': {
      const pid = str(d.product_id);
      return `${e.action === 'INSERT' ? 'Dodano' : e.action === 'DELETE' ? 'Usunięto' : 'Zmieniono'} pozycję zakupu: ${l.productName(pid)} ${formatQty(str(d.quantity))} ${unitLabel(l.productUnit(pid))}`;
    }
    case 'suppliers':
      return `${e.action === 'INSERT' ? 'Dodano' : e.action === 'DELETE' ? 'Usunięto' : 'Zmieniono'} dostawcę „${str(d.name)}”`;
    case 'product_categories':
      return `${e.action === 'INSERT' ? 'Dodano' : e.action === 'DELETE' ? 'Usunięto' : 'Zmieniono'} kategorię „${str(d.name)}”`;
    case 'profiles': {
      const who = l.userName(str(d.id)) || str(d.full_name);
      if (e.action === 'INSERT')
        return `Utworzono konto: ${str(d.full_name)} (${ROLE_LABEL[str(d.role)] ?? str(d.role)})`;
      if (e.action === 'DELETE') return `Usunięto konto: ${str(d.full_name)}`;
      if (o?.role !== n?.role)
        return `Zmieniono rolę użytkownika ${who}: ${ROLE_LABEL[str(o?.role)] ?? str(o?.role)} → ${ROLE_LABEL[str(n?.role)] ?? str(n?.role)}`;
      if (o?.active !== n?.active) return n?.active ? `Aktywowano konto: ${who}` : `Dezaktywowano konto: ${who}`;
      return `Zmieniono dane użytkownika ${who}`;
    }
    case 'restaurants':
      return 'Zmieniono ustawienia lokalu';
    default:
      return `${e.action === 'INSERT' ? 'Dodano' : e.action === 'DELETE' ? 'Usunięto' : 'Zmieniono'} rekord (${e.table_name})`;
  }
}
