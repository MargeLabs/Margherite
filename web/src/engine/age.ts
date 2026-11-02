// L'âge est une donnée du contexte, jamais une norme. Inconnu, il reste inconnu.
export function ageInDays(birthAt: number | null, now: number): number | null {
  if (birthAt === null || now < birthAt) return null;
  const a = new Date(birthAt), b = new Date(now);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}
