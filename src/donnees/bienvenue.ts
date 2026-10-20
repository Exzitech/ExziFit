/** But choisi au premier lancement ; seulement pour proposer un programme, jamais enregistré. */
export type But = "force" | "muscle" | "endurance" | "sans-materiel";

export const BUTS: But[] = ["force", "muscle", "endurance", "sans-materiel"];
export const SEANCES_SEMAINE = [3, 4, 5, 6] as const;

/**
 * Programme fourni proposé d'après le but et les séances par semaine. Les programmes tournent par
 * jours, pas par calendrier : seul le muscle dépend de la fréquence (le PPL ne revoit chaque muscle
 * qu'une fois en 6 séances : sous 5 par semaine, le haut / bas en 4 jours les revoit plus souvent).
 */
export function programmePropose(but: But, seances: number): string {
  switch (but) {
    case "force": return "bloc-force";
    case "endurance": return "endurance";
    case "sans-materiel": return "calisthenie";
    case "muscle": return seances >= 5 ? "push-pull-legs" : "superset-express";
  }
}
