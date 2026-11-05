// SupabaseRepo.journalAfter : table absente ou illisible = null (mode dégradé) ; panne réseau = erreur ; lecture par pages au-delà de `after`.
import { describe, expect, it, vi } from 'vitest';

type Reply = { data: unknown[] | null; error: { code: string; message: string } | null };
let reply: (from: number, to: number) => Reply;
const asked: Array<{ gt?: number; from: number; to: number }> = [];

vi.mock('@/lib/supabase', () => ({
  supabase: () => ({
    from: () => ({
      select: () => {
        const call: { gt?: number } = {};
        const q = {
          gt: (_c: string, v: number) => { call.gt = v; return q; },
          order: () => q,
          range: (from: number, to: number) => { asked.push({ ...call, from, to }); return Promise.resolve(reply(from, to)); },
        };
        return q;
      },
    }),
  }),
}));

const { SupabaseRepo } = await import('./supabaseRepo');
const row = (seq: number) => ({ seq });

describe('SupabaseRepo.journalAfter', () => {
  it.each(['PGRST205', '42P01', '42501'])('code %s : le journal est absent, pas une erreur', async (code) => {
    reply = () => ({ data: null, error: { code, message: 'x' } });
    expect(await new SupabaseRepo().journalAfter(0)).toBeNull();
  });
  it('toute autre erreur (réseau) est relancée : le journal déjà lu est gardé par l’appelant', async () => {
    reply = () => ({ data: null, error: { code: '08006', message: 'réseau' } });
    await expect(new SupabaseRepo().journalAfter(0)).rejects.toThrow('réseau');
  });
  it('ne demande que les entrées après `after`, page par page', async () => {
    asked.length = 0;
    reply = (from) => ({ data: from === 0 ? Array.from({ length: 1000 }, (_, i) => row(i + 6)) : [row(1006)], error: null });
    const rows = await new SupabaseRepo().journalAfter(5);
    expect(rows).toHaveLength(1001);
    expect(asked.map((a) => a.gt)).toEqual([5, 5]);
    expect(asked[1]).toMatchObject({ from: 1000 });
  });
});
