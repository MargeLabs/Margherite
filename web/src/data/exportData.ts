import { localDay } from '@/lib/time';
import type { Snapshot } from './repo';

/** La sauvegarde complète, telle qu'on la télécharge : tout l'historique, pas seulement la fenêtre affichée. */
export function backupJson(s: Snapshot, now: Date): string {
  return JSON.stringify({ app: 'margherite', version: 1, exportedAt: now.toISOString(), ...s }, null, 1);
}

/** Feuille de partage sur téléphone (« Enregistrer dans Fichiers »), téléchargement sinon. */
export async function saveFile(name: string, text: string): Promise<void> {
  const file = new File([text], name, { type: 'application/json' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // fermée par l'utilisatrice : rien à faire
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const backupName = (now: Date): string => `margherite-sauvegarde-${localDay(now)}.json`;
