// Identifiant de ce téléphone, tiré au hasard une fois et gardé sur l'appareil. Il ne dit rien de la personne ni du téléphone :
// il sert seulement au journal des modifications (0004) à distinguer « écrit par le téléphone A » de « écrit par le téléphone B ».
const KEY = 'canaille.device.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null, mint: () => string = () => crypto.randomUUID()): string | null {
  if (!storage) return null;
  try {
    const known = storage.getItem(KEY);
    if (known && UUID.test(known)) return known;
    const id = mint();
    storage.setItem(KEY, id);
    return id;
  } catch {
    return null; // stockage bloqué (navigation privée) : on écrit sans identifiant, le journal le note vide
  }
}

/** Valeur de l'en-tête X-Client-Info : déjà envoyé par supabase-js (donc accepté par l'API), lu par le journal côté base. */
export const clientInfo = (id: string | null): string => `supabase-js-web${id ? ` canaille-device/${id}` : ''}`;
