// L'identifiant de la version en ligne, jamais mis en cache : voir src/lib/autoUpdate.ts.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ id: process.env.NEXT_PUBLIC_BUILD_ID ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
