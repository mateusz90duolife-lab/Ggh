import { handleAdminUsers } from '../_shared/adminUsers.ts';

Deno.serve((req) =>
  handleAdminUsers(
    req,
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ALLOWED_ORIGIN: Deno.env.get('ALLOWED_ORIGIN') ?? undefined,
    },
    (input, init) => fetch(input, init),
  ),
);
