// Les NEXT_PUBLIC_* doivent être lues littéralement pour que Next les injecte au build.
export type DataMode = 'supabase' | 'local';

export interface AppConfig {
  dataMode: DataMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  familyEmail: string;
}

export const config: AppConfig = {
  dataMode: process.env.NEXT_PUBLIC_DATA === 'local' ? 'local' : 'supabase',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  familyEmail: process.env.NEXT_PUBLIC_FAMILY_EMAIL ?? '',
};

/** Message lisible si la configuration Supabase est incomplète, sinon null. */
export function configProblem(c: AppConfig = config): string | null {
  if (c.dataMode === 'local') return null;
  if (!c.supabaseUrl || !c.supabaseAnonKey) return 'Supabase n’est pas configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.';
  if (!c.familyEmail) return 'Il manque NEXT_PUBLIC_FAMILY_EMAIL (l’adresse de l’utilisateur famille).';
  return null;
}
