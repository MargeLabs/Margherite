import { localDay } from '@/lib/time';
import { LOG_KEY, type KeyValueStore } from '@/engine/evaluation/forecastLog';
import { SHADOW_KEY } from '@/engine/evaluation/shadowLog';
import { HISTORY_KEY } from '@/engine/intelligence/history';
import type { Snapshot } from './repo';

/**
 * La sauvegarde complète, telle qu'on la télécharge : tout l'historique, pas seulement la fenêtre affichée.
 * Version 2 : ajoute `journal` (toutes les écritures, migration 0004) ou `journalNote` s'il manque. Les champs de la version 1 ne changent pas.
 * `deviceLogs` (facultatif, ajouté sans changer la version) : ce que cet appareil a mesuré en direct pour la remodélisation des prévisions,
 * les fenêtres réellement affichées (`forecastLog`), la fenêtre de chaque modèle à chaque réveil (`shadowLog`) et le modèle servi chaque jour (`modelHistory`).
 */
export interface DeviceLogs {
  forecastLog: unknown;
  shadowLog: unknown;
  modelHistory: unknown;
}

export function backupJson(s: Snapshot, now: Date, device?: DeviceLogs): string {
  return JSON.stringify({ app: 'canaille', version: 2, exportedAt: now.toISOString(), ...s, ...(device ? { deviceLogs: device } : {}) }, null, 1);
}

/** Les journaux de mesure de cet appareil, tels qu'enregistrés ; illisibles ou absents : tableau vide, jamais d'échec de la sauvegarde. */
export function readDeviceLogs(store: KeyValueStore | null): DeviceLogs | undefined {
  if (!store) return undefined;
  const read = (k: string): unknown => {
    try {
      const raw = store.getItem(k);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  return { forecastLog: read(LOG_KEY), shadowLog: read(SHADOW_KEY), modelHistory: read(HISTORY_KEY) };
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

export const backupName = (now: Date): string => `canaille-sauvegarde-${localDay(now)}.json`;
