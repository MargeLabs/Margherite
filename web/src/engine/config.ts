// Registre unique des seuils. Le calcul en production garde les siens tant qu'il n'est pas extrait (phase C) :
// ce registre les recopie à l'identique pour les rendre visibles, sans corriger leurs contradictions (phase D).
// statut : jugement = choisi à la main ; cas-reel = ajusté sur un cas vécu ; demande = décidé par Victor ; mesure = validé au backtest ; source = publié.

export type ThresholdStatus = 'jugement' | 'cas-reel' | 'demande' | 'mesure' | 'source';

export interface Threshold {
  value: number;
  unit: 'min' | 'min-du-jour' | 'jours' | 'nuits' | 'cas' | 'ratio' | 'mL' | 'nb';
  why: string;
  status: ThresholdStatus;
  /** devrait dépendre de l'âge ; aucun seuil actuel n'en dépend */
  ageDependent: boolean;
  usedBy: string;
}

const T = (value: number, unit: Threshold['unit'], why: string, status: ThresholdStatus, ageDependent: boolean, usedBy: string): Threshold => ({ value, unit, why, status, ageDependent, usedBy });

export const THRESHOLDS = {
  // journée et nuit : définitions contradictoires, notées ici, traitées en phase D
  napDayStart: T(420, 'min-du-jour', 'début du jour pour une sieste : 7 h', 'jugement', true, 'isNapAt'),
  napDayEnd: T(1170, 'min-du-jour', 'fin du jour pour une sieste : 19 h 30', 'jugement', true, 'isNapAt'),
  observationDayEnd: T(1110, 'min-du-jour', 'dernier repas pris en compte avant une sieste : 18 h 30 (fin d’une chaîne repas puis sieste, autre usage que napDayEnd)', 'jugement', true, 'rFw'),
  summaryDayEnd: T(1260, 'min-du-jour', 'fin du temps d’éveil compté dans le Résumé : 21 h (autre usage que napDayEnd : on compte l’éveil tant que le bébé n’est pas couché)', 'jugement', true, 'awDay'),
  nightDefaultStart: T(1140, 'min-du-jour', 'début de nuit par défaut : 19 h', 'cas-reel', true, 'nightWin'),
  nightDefaultEnd: T(540, 'min-du-jour', 'fin de nuit par défaut : 9 h', 'cas-reel', true, 'nightWin'),
  nightBedEarliest: T(1020, 'min-du-jour', 'borne basse de la fenêtre adaptée : 17 h', 'cas-reel', true, 'nightWin'),
  nightBedLatest: T(1260, 'min-du-jour', 'borne haute de la fenêtre adaptée : 21 h', 'cas-reel', true, 'nightWin'),
  nightWakeEarliest: T(390, 'min-du-jour', 'borne basse de fin de nuit : 6 h 30', 'cas-reel', true, 'nightWin'),
  nightWakeLatest: T(540, 'min-du-jour', 'borne haute de fin de nuit : 9 h', 'cas-reel', true, 'nightWin'),
  nightBedLead: T(120, 'min', 'la fenêtre s’ouvre 2 h avant le coucher habituel', 'cas-reel', true, 'nightWin'),
  nightWakeLag: T(30, 'min', 'la fenêtre se ferme 30 min après le réveil habituel', 'cas-reel', true, 'nightWin'),
  nightWinMinNights: T(3, 'nuits', 'nuits complètes requises pour adapter la fenêtre', 'jugement', false, 'nightWin'),
  nightHabMinNights: T(2, 'nuits', 'nuits observées requises pour un coucher habituel (exception du premier bloc court), sans adapter la fenêtre', 'jugement', false, 'nightWin'),
  nightChainGap: T(50, 'min', 'éveil maximal entre deux blocs d’une même nuit', 'cas-reel', true, 'nightIn'),
  nightMinTotal: T(90, 'min', 'sommeil total minimal d’une chaîne de nuit', 'cas-reel', true, 'nightIn'),
  nightFirstBlock: T(60, 'min', 'durée minimale du premier bloc de nuit', 'cas-reel', true, 'nightIn'),
  nightFirstHabTol: T(45, 'min', 'un premier bloc court reste le coucher s’il commence à moins de 45 min du coucher habituel', 'jugement', true, 'nightIn'),
  nightObservedLead: T(120, 'min', 'un coucher à moins de 2 h du premier événement du journal n’est pas observé : sa nuit n’est pas complète', 'jugement', false, 'nightIn'),
  nightCompleteAfter: T(330, 'min-du-jour', 'nuit complète si elle finit après 5 h 30 ; un lever réel à 5 h 20 reste partielle', 'jugement', true, 'nightIn'),
  nightStartLatest: T(120, 'min-du-jour', 'le premier bloc doit commencer avant 2 h', 'jugement', true, 'nightIn'),
  napMergeGap: T(30, 'min', 'deux siestes séparées d’au plus 30 min n’en font qu’une', 'demande', true, 'SL'),
  nightMergeGap: T(15, 'min', 'deux dodos de nuit séparés d’au plus 15 min n’en font qu’un (4 min d’éveil n’en est pas un)', 'demande', true, 'SL'),
  // complétude et habitudes
  gapMinutes: T(300, 'min', 'un trou de plus de 5 h après 6 h rend la journée incomplète', 'jugement', true, 'dayOf'),
  gapAfter: T(360, 'min-du-jour', 'le trou ne compte qu’après 6 h', 'jugement', true, 'dayOf'),
  habitDays: T(3, 'jours', 'journées complètes requises pour une journée type', 'jugement', false, 'typ'),
  habitWindowDays: T(7, 'jours', 'fenêtre de la journée type', 'jugement', true, 'typ'),
  habitRankDays: T(2, 'jours', 'jours requis pour retenir un rang de sieste', 'jugement', false, 'typ'),
  usualNights: T(3, 'nuits', 'nuits requises pour une nuit habituelle', 'jugement', false, 'usual'),
  windowMinHalf: T(15, 'min', 'demi-largeur minimale d’une fenêtre de dodo', 'jugement', false, 'wins'),
  reliabilityHigh: T(0.8, 'ratio', 'présence pour deux points de fiabilité', 'jugement', false, 'lvOf'),
  reliabilityMid: T(0.5, 'ratio', 'présence pour un point de fiabilité', 'jugement', false, 'lvOf'),
  reliabilityStable: T(20, 'min', 'dispersion pour un point de plus', 'jugement', false, 'lvOf'),
  reliabilityCapDays: T(5, 'jours', 'sous ce nombre de jours, deux points au plus', 'jugement', false, 'lvOf'),
  rangeTrimFrom: T(5, 'cas', 'dès 5 valeurs, une plage habituelle écarte les deux extrêmes', 'jugement', false, 'lohi'),
  napAfterWake: T(5, 'min', 'un sommeil compte comme sieste s’il commence plus de 5 min après le réveil', 'jugement', false, 'dayOf'),
  nightFeedCutoff: T(480, 'min-du-jour', 'une nuit absente compte les repas jusqu’à 8 h', 'jugement', true, 'nightIn'),
  dayBandShare: T(0.5, 'ratio', 'part des jours pour dessiner un créneau de la journée type', 'jugement', false, 'typ'),
  mealGroupGap: T(40, 'min', 'deux repas plus proches appartiennent au même repas habituel', 'jugement', true, 'typ'),
  habitHourTolerance: T(10, 'min', 'marge autour de la plage habituelle d’une sieste', 'jugement', false, 'habitOf'),
  habitBedTolerance: T(15, 'min', 'marge autour de la plage habituelle du coucher', 'jugement', false, 'habitOf'),
  habitSameDuration: T(15, 'min', 'écart considéré comme habituel', 'jugement', false, 'habitOf'),
  statMinPoints: T(3, 'cas', 'points requis pour une moyenne de période', 'jugement', false, 'stat'),
  // observations et liens
  linkHistoryDays: T(21, 'jours', 'recul maximal des liens journée puis nuit', 'jugement', true, 'lkR'),
  linkSolidGroup: T(8, 'nuits', 'groupe requis pour un lien solide', 'jugement', false, 'lkEval'),
  linkManyNaps: T(4, 'nb', 'à partir de ce nombre, une journée a beaucoup de siestes', 'jugement', true, 'lkR'),
  assocMinNights: T(14, 'nuits', 'nuits requises avant de tester une association', 'jugement', false, 'associations'),
  assocPermutations: T(999, 'nb', 'tirages de la permutation', 'jugement', false, 'associations'),
  assocBlockDays: T(3, 'jours', 'taille des blocs permutés', 'jugement', false, 'associations'),
  assocFdr: T(0.1, 'ratio', 'taux de fausses découvertes accepté', 'jugement', false, 'associations'),
  forecastMaxWidth: T(180, 'min', 'au-delà, une fenêtre n’informe plus : abstention', 'jugement', true, 'forecast'),
  nightEarlyAfter: T(240, 'min-du-jour', 'avant 4 h, une fin de sommeil n’est jamais un lever', 'jugement', true, 'nightIn'),
  nightEarlyMinTotal: T(240, 'min', 'sommeil noté requis pour accepter un lever tôt', 'jugement', true, 'nightIn'),
  nightEarlyEvidence: T(180, 'min', 'un événement noté dans ce délai prouve le lever', 'jugement', false, 'nightIn'),
  linkGroupMin: T(5, 'nuits', 'nuits requises de chaque côté d’un lien', 'jugement', false, 'lkEval'),
  linkMinGap: T(30, 'min', 'écart net d’un lien', 'jugement', true, 'lkEval'),
  linkSameWay: T(0.7, 'ratio', 'part des nuits dans le même sens ; 19 % par hasard sur 5 nuits', 'jugement', false, 'lkEval'),
  obsSolidCases: T(8, 'cas', 'cas requis pour une observation solide', 'jugement', false, 'rC'),
  obsSolidDays: T(5, 'jours', 'jours requis pour une observation solide', 'jugement', false, 'rC'),
  obsSolidSpread: T(45, 'min', 'dispersion maximale d’une observation solide', 'jugement', true, 'rC'),
  mealAfterWake: T(10, 'min', 'repas tout de suite après le réveil', 'jugement', true, 'habitude d’éveil'),
  mealBeforeSleep: T(30, 'min', 'repas juste avant le dodo', 'jugement', true, 'habitude d’éveil'),
  sleepAfterMeal: T(240, 'min', 'délai maximal entre un repas et le dodo suivant', 'jugement', true, 'rFw, awDay'),
  mealGapMax: T(360, 'min', 'un écart plus long entre deux repas n’est pas un intervalle', 'jugement', true, 'awDay'),
  // modèles candidats et règle d'activation
  modelHistoryDays: T(14, 'jours', 'historique des modèles', 'jugement', true, 'models'),
  modelMinGaps: T(8, 'cas', 'exemples requis avant de répondre', 'jugement', false, 'models'),
  forecastDayStart: T(360, 'min-du-jour', 'pas de prévision de dodo avant 6 h', 'jugement', true, 'viewNextSleep'),
  forecastDayEnd: T(1260, 'min-du-jour', 'pas de prévision de dodo après 21 h', 'jugement', true, 'viewNextSleep'),
  survivalStepMin: T(15, 'min', 'pas de temps du modèle de survie', 'jugement', false, 'survival'),
  survivalRidge: T(1, 'nb', 'pénalité : retient les coefficients quand les données manquent', 'jugement', false, 'survival'),
  survivalIterations: T(150, 'nb', 'itérations d’ajustement', 'jugement', false, 'survival'),
  feedClusterMin: T(30, 'min', 'des tétées plus proches comptent pour un seul repas', 'jugement', true, 'nextFeed'),
  changeMinDays: T(10, 'jours', 'jours requis pour qualifier une évolution', 'jugement', false, 'change'),
  changeConfirmDays: T(3, 'jours', 'jours concordants requis pour une rupture', 'jugement', false, 'change'),
  changeZ: T(2, 'nb', 'écart net, en écarts robustes', 'jugement', false, 'change'),
  changeMinSpread: T(0.25, 'nb', 'écart robuste minimal, pour les séries presque constantes', 'jugement', false, 'change'),
  changeCusumLimit: T(5, 'nb', 'seuil du CUSUM', 'jugement', false, 'change'),
  conformalHistory: T(40, 'cas', 'prévisions passées utilisées pour calibrer', 'jugement', false, 'conformal'),
  conformalMinCases: T(10, 'cas', 'cas requis avant de calibrer', 'jugement', false, 'conformal'),
  holdoutShare: T(0.2, 'ratio', 'part finale gelée de l’historique', 'demande', false, 'selection'),
  holdoutMinDays: T(14, 'jours', 'durée minimale de la période gelée', 'demande', false, 'selection'),
  gainMin: T(0.1, 'ratio', 'gain d’erreur médiane exigé', 'demande', false, 'selection'),
  coverageTolerance: T(0.05, 'ratio', 'écart de couverture toléré', 'demande', false, 'selection'),
  widthMaxRatio: T(1.25, 'ratio', 'largeur maximale face à la référence', 'demande', false, 'selection'),
  // intelligence individuelle : apprentissage, coucher, durée de sieste, évaluation continue
  learnHalfLife: T(7, 'jours', 'demi-vie du poids des jours récents', 'jugement', true, 'learn'),
  learnHalfLifeBreak: T(3, 'jours', 'demi-vie après une rupture détectée : l’ancien rythme compte moins', 'jugement', true, 'learn'),
  bedMinNights: T(5, 'nuits', 'couchers observés requis avant de prévoir le coucher', 'jugement', false, 'bedtime'),
  napDurMinCases: T(5, 'cas', 'siestes passées requises avant de prévoir une durée', 'jugement', false, 'napDuration'),
  napDurBandMin: T(90, 'min', 'une sieste est comparable si elle commence à moins de 1 h 30 de la même heure', 'jugement', true, 'napDuration'),
  liveEntryMax: T(10, 'min', 'un dodo noté dans ce délai après son début a été connu en direct : on a pu prévoir sa durée', 'jugement', false, 'napDuration'),
  evalMaxDecisions: T(30, 'cas', 'décisions récentes rejouées pour comparer les modèles sur le bébé', 'jugement', true, 'selection'),
  // analyse transversale
  dayTypesMinDays: T(14, 'jours', 'jours complets requis pour des types de journées', 'jugement', false, 'dayTypes'),
  dayTypesMinGroup: T(4, 'jours', 'taille minimale d’un type', 'jugement', false, 'dayTypes'),
  dayTypesMinDistance: T(2, 'nb', 'écart minimal entre deux types, en écarts types au carré', 'jugement', false, 'dayTypes'),
  motifMinDays: T(10, 'jours', 'jours complets requis pour chercher des motifs', 'jugement', false, 'sequences'),
  motifLength: T(3, 'nb', 'longueur d’un motif', 'jugement', false, 'sequences'),
  motifShuffles: T(200, 'nb', 'journées mélangées de comparaison', 'jugement', false, 'sequences'),
  motifMinSupport: T(0.6, 'ratio', 'part des jours où le motif doit apparaître', 'jugement', false, 'sequences'),
  motifMinLift: T(0.2, 'ratio', 'avance minimale sur le hasard', 'jugement', false, 'sequences'),
  // moteur : alimentation, qualité et références de comparaison
  feedingModeDays: T(7, 'jours', 'fenêtre de déduction du mode d’alimentation', 'jugement', false, 'feedingMode'),
  feedingModeMinFeeds: T(10, 'cas', 'repas requis avant de déduire un mode', 'jugement', false, 'feedingMode'),
  feedingModeExclusive: T(0.9, 'ratio', 'part au-delà de laquelle un mode est dit exclusif', 'jugement', false, 'feedingMode'),
  qualityDuplicateMin: T(1, 'min', 'deux événements du même type à moins d’une minute', 'jugement', false, 'quality'),
  qualitySleepMaxMin: T(960, 'min', 'un sommeil de plus de 16 h est suspect', 'jugement', true, 'quality'),
  qualityOpenSleepMaxMin: T(840, 'min', 'un chrono ouvert depuis plus de 14 h est suspect', 'jugement', true, 'quality'),
  qualityBottleMaxMl: T(400, 'mL', 'un biberon au-delà est suspect, sans rien affirmer', 'jugement', true, 'quality'),
  qualityLateEntryMin: T(60, 'min', 'au-delà, une saisie est dite tardive', 'jugement', false, 'quality'),
  baselineDays: T(7, 'jours', 'historique des références de comparaison', 'jugement', true, 'baselines'),
  baselineMinGaps: T(5, 'cas', 'éveils requis pour une référence', 'jugement', false, 'baselines'),
  baselineMaxAwake: T(300, 'min', 'un éveil plus long est traité comme un trou de saisie', 'jugement', true, 'baselines'),
} as const satisfies Record<string, Threshold>;

export type ThresholdName = keyof typeof THRESHOLDS;
export const threshold = (name: ThresholdName): number => THRESHOLDS[name].value;
