import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

let client: SupabaseClient | null = null;

/** Client Supabase unique. La session (jeton de l'utilisateur famille) reste dans le navigateur d'un lancement à l'autre. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'margherite-auth' },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/** Connexion avec le code famille (= mot de passe de l'utilisateur famille). Retourne un message d'erreur lisible ou null. */
export async function signInWithFamilyCode(code: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithPassword({ email: config.familyEmail, password: code });
  if (!error) return null;
  return /invalid login/i.test(error.message) ? 'Ce code n’est pas le bon.' : 'Connexion impossible pour le moment. Vérifie ta connexion et réessaie.';
}
