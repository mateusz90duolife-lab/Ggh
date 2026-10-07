export function getConfig() {
    const c = window.__CONFIG__;
    if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY)
        return null;
    return { SUPABASE_URL: c.SUPABASE_URL.replace(/\/+$/, ''), SUPABASE_ANON_KEY: c.SUPABASE_ANON_KEY };
}
