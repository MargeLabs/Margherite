import { describe, expect, it } from 'vitest';
import { clientInfo, deviceId } from './device';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('identifiant du téléphone', () => {
  it('est tiré une fois puis gardé', () => {
    const s = memory();
    let n = 0;
    const mint = () => (n++ ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : A);
    expect(deviceId(s, mint)).toBe(A);
    expect(deviceId(s, mint)).toBe(A);
  });
  it('sans stockage ou stockage bloqué : pas d’identifiant, jamais d’erreur', () => {
    expect(deviceId(null)).toBeNull();
    expect(deviceId({ getItem: () => { throw new Error('bloqué'); }, setItem: () => undefined })).toBeNull();
  });
  it('une valeur abîmée est remplacée', () => {
    const s = memory();
    s.setItem('canaille.device.v1', 'nimporte quoi');
    expect(deviceId(s, () => A)).toBe(A);
  });
  it('l’en-tête porte l’identifiant dans le format que lit la base', () => {
    expect(clientInfo(A)).toMatch(/canaille-device\/([0-9a-fA-F-]{8,64})/);
    expect(clientInfo(null)).toBe('supabase-js-web');
  });
});
