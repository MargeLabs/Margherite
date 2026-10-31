'use client';

import { useEffect } from 'react';

const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? '';
const KEY = 'margherite.reloadedAt';

/**
 * Une web app posée sur l'écran d'accueil de l'iPhone reste en mémoire quand on la quitte : elle reprend l'ancienne version
 * sans jamais recharger. Quand l'app revient au premier plan, on demande au serveur sa version ; si elle a changé, on recharge
 * (au plus une fois par minute, pour ne jamais tourner en boucle). Les données, elles, sont déjà enregistrées en base.
 */
export function useAutoUpdate(): void {
  useEffect(() => {
    if (!MINE) return undefined;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const last = Number(sessionStorage.getItem(KEY) ?? 0);
        if (Date.now() - last < 60_000) return;
        const res = await fetch('/version', { cache: 'no-store' });
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== MINE) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // hors connexion : on réessaiera au prochain retour au premier plan
      }
    };
    void check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
}
