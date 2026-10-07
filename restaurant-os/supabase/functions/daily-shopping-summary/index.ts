import { handleDailySummary } from '../_shared/dailySummary.ts';

Deno.serve((req) =>
  handleDailySummary(req, {
    env: {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      CRON_SECRET: Deno.env.get('CRON_SECRET') ?? undefined,
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? undefined,
      MAIL_FROM: Deno.env.get('MAIL_FROM') ?? undefined,
      ALLOWED_ORIGIN: Deno.env.get('ALLOWED_ORIGIN') ?? undefined,
    },
    fetchFn: (input, init) => fetch(input, init),
  }),
);
