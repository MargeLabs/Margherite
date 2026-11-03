// Les corrections de la phase D. `LEGACY_RULES` reproduit la production à l'identique, pour la preuve de parité ; `CURRENT_RULES` est le moteur corrigé.
export interface Rules {
  /** une nuit finie tôt est complète si le journal montre qu'il s'est vraiment levé */
  earlyWakeNight: boolean;
  /** un jour de changement d'heure n'entre pas dans les habitudes */
  excludeDstDays: boolean;
  /** une sieste se situe entre le réveil et le coucher du jour, quand ils sont connus */
  relativeDay: boolean;
  /** une nuit dont le coucher tombe au tout début du journal n'est pas une nuit complète : son coucher est inconnu */
  observedStart: boolean;
}

export const LEGACY_RULES: Rules = { earlyWakeNight: false, excludeDstDays: false, relativeDay: false, observedStart: false };
export const CURRENT_RULES: Rules = { earlyWakeNight: true, excludeDstDays: true, relativeDay: true, observedStart: true };
