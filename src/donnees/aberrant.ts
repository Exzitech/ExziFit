// Valeurs saisies à faire confirmer (« Sûr ? ») plutôt qu'à refuser : une faute de frappe (1050 pour
// 105) ferait un faux record et une fausse Force. La référence est ce que l'exo a déjà connu, si
// bien qu'une charge confirmée une fois devient la référence et ne redemande plus.

/** Plus du double de la référence (et plus de 20 kg au-dessus), ou plus de 300 kg sans référence. */
export const chargeDouteuse = (kg: number, ref = 0) => (ref > 0 ? kg > Math.max(2 * ref, ref + 20) : kg > 300);

/** Plus de 50 reps, et plus du double de ce que l'exo a déjà connu. */
export const repsDouteuses = (reps: number, ref = 0) => reps > Math.max(50, 2 * ref);

const horsPlage = (kg: number) => kg < 30 || kg > 200;

/**
 * Hors de 30–200 kg, ou plus de 15 % d'écart avec la dernière pesée, sauf si celle-ci est elle-même
 * hors plage (corriger un 820 confirmé par erreur ne redemande rien).
 */
export const poidsCorpsDouteux = (kg: number, ref?: number) =>
  horsPlage(kg) || (ref !== undefined && !horsPlage(ref) && Math.abs(kg - ref) > 0.15 * ref);

/** RIR au-delà de 10 : la saisie au Journal est libre, la séance s'arrête à 4+. */
export const rirDouteux = (rir: number) => rir > 10;
