// Prévision ou recommandation ? Deux notions distinctes :
// - prévision (`forecast`) : la fenêtre que le moteur présente comme sa prévision (modèle choisi, ou créneau habituel cohérent) ;
// - recommandation (`recommendation`) : une fenêtre CONSEILLÉE, calculée à partir de ses éveils observés, même quand aucune prévision n'est possible.
// La recommandation ne remplace jamais une prévision tant qu'elle reste cohérente avec elle. Elle prend la place seulement s'il n'y a pas de prévision,
// ou si le créneau habituel (une référence non validée) ferait attendre au-delà de ce que ses éveils observés rendent plausible.
import type { Window } from '../predictions/baselines';
import type { Recommendation } from '../predictions/recommendation';

export type Display = 'forecast' | 'recommendation' | null;

export function chooseDisplay(p: { shown: boolean; model: string; reference: string; window: Window | null }, reco: Recommendation | null): Display {
  if (!p.shown || !p.window) return reco ? 'recommendation' : null;
  // le créneau habituel commence après la fin de la fenêtre conseillée : il ferait attendre trop longtemps par rapport à ses éveils observés
  if (p.model === p.reference && reco && p.window.from > reco.window.to) return 'recommendation';
  return 'forecast';
}
