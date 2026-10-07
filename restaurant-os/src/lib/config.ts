export interface AppConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

declare global {
  interface Window {
    __CONFIG__?: Partial<AppConfig>;
  }
}

export function getConfig(): AppConfig | null {
  const c = window.__CONFIG__;
  if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return null;
  return { SUPABASE_URL: c.SUPABASE_URL.replace(/\/+$/, ''), SUPABASE_ANON_KEY: c.SUPABASE_ANON_KEY };
}
