// Tylko dla `tsc` w repo: deklaracje używane przez index.ts funkcji (w Supabase Edge Runtime globalne `Deno` istnieje).
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: { get(key: string): string | undefined };
}

// Typy SDK w Deno pobiera sam runtime (specyfikator npm:); dla `tsc` w repo wystarczy opis używanej części.
declare module 'npm:@anthropic-ai/sdk@0.131.0' {
  class APIError extends Error {
    status: number | undefined;
  }
  export default class Anthropic {
    constructor(opts: { apiKey: string; maxRetries?: number; timeout?: number });
    beta: { messages: unknown };
    static APIError: typeof APIError;
    static AuthenticationError: typeof APIError;
    static PermissionDeniedError: typeof APIError;
    static RateLimitError: typeof APIError;
    static InternalServerError: typeof APIError;
    static BadRequestError: typeof APIError;
  }
}
