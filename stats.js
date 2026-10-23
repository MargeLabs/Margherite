// Calculs purs. `at` = "YYYY-MM-DDTHH:mm" en heure locale (valeur d'un <input type="datetime-local">).
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);
const div = (a, b) => (b ? a / b : 0);

export const total = (t) => t.left + t.right;

export function byDay(sessions) {
  const days = new Map();
  for (const t of sessions) {
    const day = t.at.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(t);
  }
  return [...days]
    .map(([day, list]) => {
      const sorted = list.sort((a, b) => b.at.localeCompare(a.at));
      const tot = sum(sorted, total);
      return {
        day,
        sessions: sorted,
        total: tot,
        left: sum(sorted, (t) => t.left),
        right: sum(sorted, (t) => t.right),
        count: sorted.length,
        avgPerSession: div(tot, sorted.length),
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}

// ponytail: jours = jours ayant ≥ 1 tirage (un jour vide ne tire pas la moyenne vers 0)
export function overall(sessions) {
  const days = byDay(sessions);
  const count = sessions.length;
  const tot = sum(sessions, total);
  return {
    total: tot,
    count,
    days: days.length,
    avgPerDay: div(tot, days.length),
    avgPerSession: div(tot, count),
    avgLeft: div(sum(sessions, (t) => t.left), count),
    avgRight: div(sum(sessions, (t) => t.right), count),
  };
}
