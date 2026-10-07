// Tylko dla `tsc` w repo: deklaracje używane przez index.ts funkcji (w Supabase Edge Runtime globalne `Deno` istnieje).
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  const env: { get(key: string): string | undefined };
}
