// Wspólne typy dla funkcji Edge (bez zależności zewnętrznych — tylko fetch).
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Wymagane tylko przez daily-shopping-summary. */
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  /** Opcjonalnie: jedyna dozwolona domena aplikacji dla CORS (np. https://restauracja.vercel.app). */
  ALLOWED_ORIGIN?: string;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface Caller {
  id: string;
  restaurant_id: string;
  role: 'owner' | 'manager' | 'employee';
  active: boolean;
}
