import { getSession } from './api/auth.js';
import { list, one, eq } from './api/db.js';
import { todayIn } from './lib/format.js';
import type { Category, Product, Profile, Restaurant, Role } from './types.js';

export type ContextStatus = 'ok' | 'no-profile' | 'inactive';

export interface TeamMember {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  nick: string | null;
}

interface Ctx {
  profile: Profile | null;
  restaurant: Restaurant | null;
  names: Map<string, string>;
  team: TeamMember[];
}

const ctx: Ctx = { profile: null, restaurant: null, names: new Map(), team: [] };

export function resetContext(): void {
  ctx.profile = null;
  ctx.restaurant = null;
  ctx.names = new Map();
  ctx.team = [];
}

export async function loadContext(): Promise<ContextStatus> {
  const s = getSession();
  if (!s) return 'no-profile';
  const profile = await one<Profile>('profiles', {
    select: 'id,restaurant_id,full_name,role,active,nick',
    params: { id: eq(s.user.id) },
  });
  if (!profile) return 'no-profile';
  if (!profile.active) return 'inactive';
  ctx.profile = profile;
  const [restaurant, team] = await Promise.all([
    one<Restaurant>('restaurants', { select: 'id,name,timezone,summary_time,summary_emails' }),
    list<TeamMember>('profiles', { select: 'id,full_name,role,active,nick', order: 'full_name.asc' }),
  ]);
  ctx.restaurant = restaurant;
  ctx.team = team;
  ctx.names = new Map(team.map((t) => [t.id, t.full_name]));
  return 'ok';
}

export const profile = (): Profile | null => ctx.profile;
/** Zespół lokalu (z kontekstu); reloadTeam odświeża po zmianach kont. */
export const team = (): TeamMember[] => ctx.team;
export async function reloadTeam(): Promise<TeamMember[]> {
  ctx.team = await list<TeamMember>('profiles', { select: 'id,full_name,role,active,nick', order: 'full_name.asc' });
  for (const t of ctx.team) ctx.names.set(t.id, t.full_name);
  return ctx.team;
}
export const restaurant = (): Restaurant | null => ctx.restaurant;
export const role = (): Role | null => ctx.profile?.role ?? null;
export const isManager = (): boolean => role() === 'manager' || role() === 'owner';
export const isOwner = (): boolean => role() === 'owner';
export const tz = (): string => ctx.restaurant?.timezone ?? 'Europe/Warsaw';
export const today = (): string => todayIn(tz());

export function nameOf(id: string | null | undefined): string {
  if (!id) return '—';
  return ctx.names.get(id) ?? 'Nieznany użytkownik';
}

export function rememberName(id: string, name: string): void {
  ctx.names.set(id, name);
}

export function homePath(r: Role | null): string {
  return r === 'manager' || r === 'owner' ? '/dashboard' : '/dzisiaj';
}

export async function loadCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
  const [products, categories] = await Promise.all([
    list<Product>('products', { select: 'id,name,unit,minimum_stock,active,category_id,icon', order: 'name.asc' }),
    list<Category>('product_categories', { select: 'id,name,sort_order', order: 'sort_order.asc,name.asc' }),
  ]);
  return { products, categories };
}
