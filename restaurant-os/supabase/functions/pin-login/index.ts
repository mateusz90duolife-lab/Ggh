import { handlePinLogin } from '../_shared/pinLogin.ts';

Deno.serve((req) =>
  handlePinLogin(req, {
    env: {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      PIN_SECRET: Deno.env.get('PIN_SECRET') ?? undefined,
      ALLOWED_ORIGIN: Deno.env.get('ALLOWED_ORIGIN') ?? undefined,
    },
    fetchFn: (input, init) => fetch(input, init),
  }),
);
