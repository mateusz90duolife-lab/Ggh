import { getSession } from './api/auth.js';
import { list, one, eq } from './api/db.js';
import { todayIn } from './lib/format.js';
const ctx = { profile: null, restaurant: null, names: new Map() };
export function resetContext() {
    ctx.profile = null;
    ctx.restaurant = null;
    ctx.names = new Map();
}
export async function loadContext() {
    const s = getSession();
    if (!s)
        return 'no-profile';
    const profile = await one('profiles', {
        select: 'id,restaurant_id,full_name,role,active',
        params: { id: eq(s.user.id) },
    });
    if (!profile)
        return 'no-profile';
    if (!profile.active)
        return 'inactive';
    ctx.profile = profile;
    const [restaurant, team] = await Promise.all([
        one('restaurants', { select: 'id,name,timezone,summary_time,summary_emails' }),
        list('profiles', { select: 'id,full_name' }),
    ]);
    ctx.restaurant = restaurant;
    ctx.names = new Map(team.map((t) => [t.id, t.full_name]));
    return 'ok';
}
export const profile = () => ctx.profile;
export const restaurant = () => ctx.restaurant;
export const role = () => ctx.profile?.role ?? null;
export const isManager = () => role() === 'manager' || role() === 'owner';
export const isOwner = () => role() === 'owner';
export const tz = () => ctx.restaurant?.timezone ?? 'Europe/Warsaw';
export const today = () => todayIn(tz());
export function nameOf(id) {
    if (!id)
        return '—';
    return ctx.names.get(id) ?? 'Nieznany użytkownik';
}
export function rememberName(id, name) {
    ctx.names.set(id, name);
}
export function homePath(r) {
    return r === 'manager' || r === 'owner' ? '/dashboard' : '/dzisiaj';
}
export async function loadCatalog() {
    const [products, categories] = await Promise.all([
        list('products', { select: 'id,name,unit,minimum_stock,active,category_id', order: 'name.asc' }),
        list('product_categories', { select: 'id,name,sort_order', order: 'sort_order.asc,name.asc' }),
    ]);
    return { products, categories };
}
