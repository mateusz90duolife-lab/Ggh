import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { handleScanReceipt, type ClaudeErrorKind, type ClaudeMessages } from '../_shared/scanReceipt.ts';

const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Klient tworzony raz na instancję funkcji; bez klucza skaner odpowiada czytelnym komunikatem (503).
const client = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 140_000 }) : null;

function classifyError(e: unknown): ClaudeErrorKind {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'auth';
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return 'rate_limit';
  if (e instanceof Anthropic.BadRequestError) return 'bad_request';
  return 'other';
}

Deno.serve((req) =>
  handleScanReceipt(req, {
    env: {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ALLOWED_ORIGIN: Deno.env.get('ALLOWED_ORIGIN') ?? undefined,
    },
    fetchFn: (input, init) => fetch(input, init),
    claude: client ? (client.beta.messages as unknown as ClaudeMessages) : null,
    classifyError,
  }),
);
