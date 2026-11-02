// Contrôle automatique des textes que le moteur pourrait produire. Une liste de mots ne voit pas tout : les gabarits restent relus par un humain.
const LISTS: Array<[string, string[]]> = [
  ['norme', ['norme', 'normes', 'normal', 'normale', 'normales', 'normaux', 'anormal', 'anormale', 'anormaux']],
  ['jugement', ['objectif', 'retard', 'en avance', 'insuffisant', 'insuffisante', 'trop peu', 'mauvais', 'mauvaise', 'mieux que', 'moins bien']],
  ['injonction', ['devrait', 'devraient', 'devriez', 'doit', 'doivent', 'il faut', 'faut', 'évitez', 'éviter', 'attendez', 'attendre', 'limitez', 'limiter', 'retardez', 'retarder', 'espacez', 'espacer', 'réduisez', 'réduire', 'essayez', 'privilégiez', 'conseil', 'recommandé', 'recommandons']],
  ['medical', ['diagnostic', 'diagnostique', 'traitement', 'traiter', 'trouble', 'troubles', 'pathologie', 'maladie', 'prescription', 'prescrire', 'symptôme', 'symptômes']],
  ['cause', ['à cause de', 'parce que', 'provoque', 'provoquent', 'entraîne', 'entraînent', 'cause', 'causé', 'explique', 'expliquent', 'grâce à', 'donc']],
  ['genre', ['il', 'elle', 'ils', 'elles', 'lui', 'né', 'née']],
];

// \b ne connaît pas les lettres accentuées : les bornes sont écrites à la main
const RULES: Array<[string, RegExp]> = LISTS.map(([n, w]) => [n, new RegExp(`(?<![\\p{L}\\p{N}])(${w.join('|')})(?![\\p{L}\\p{N}])`, 'iu')]);

export interface Violation {
  rule: string;
  match: string;
}

export function checkText(text: string): Violation[] {
  const out: Violation[] = [];
  for (const [rule, re] of RULES) {
    const m = re.exec(text);
    if (m) out.push({ rule, match: m[0] });
  }
  return out;
}
