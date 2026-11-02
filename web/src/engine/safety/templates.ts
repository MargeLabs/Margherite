// Gabarits de faits : un code, une phrase neutre, sans genre supposé. Ils attendent une relecture humaine avant tout affichage.
export const TEMPLATES: Record<string, string> = {
  usual_wake: 'Réveil le plus souvent vers {time}, sur {days} journées notées en entier.',
  usual_bedtime: 'Coucher le plus souvent vers {time}, sur {days} journées notées en entier.',
  usual_nap: 'Sieste qui revient, d’après {days} journées notées en entier.',
  usual_nap_some_days: 'Sieste présente certains jours, d’après {days} journées notées en entier.',
  usual_nap_rank: 'Sieste numéro {rank} : le plus souvent vers {time}, durée habituelle {duration} min.',
  usual_night: 'Nuit habituelle : coucher vers {bed}, réveil vers {wake}, {wakings} réveil(s) noté(s), d’après {nights} nuits.',
  often_fed_around: 'Les repas sont souvent revenus autour de cette période ces derniers jours.',
  evolution: 'Indicateur {indicator} : {status}, sur {points} points notés.',
  association: 'Facteur {factor} et issue {outcome} varient ensemble dans ce journal, sur {n} nuits.',
  period_change: 'Indicateur {indicator} : {current} ces {days} derniers jours, {previous} sur la période d’avant.',
};

export function renderFact(code: string, params: Record<string, number | string>): string | null {
  const t = TEMPLATES[code];
  return t ? t.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')) : null;
}
