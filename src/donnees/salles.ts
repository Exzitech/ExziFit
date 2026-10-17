import { t } from "../i18n";
import { exercice, type Exercice } from "./exercices";
import { ecrireJson, FORMAT, lireJson } from "./fichier";
import type { Seance } from "./journal";

/**
 * Salles et réglages de leurs machines (docs/modele-donnees.md, « Salles »). Le journal note ce qui
 * se lit sur la machine (disques seuls, affichage de la pile) et la salle de la séance ; les
 * réglages de la salle sont appliqués à la lecture, si bien qu'une correction (76 → 70 kg) vaut
 * aussi pour les séances passées.
 */
export interface Montage {
  /** Chariot ou barre (presse, Smith) ajouté aux disques, en kg. */
  aVide?: number;
  /** Poulie double (moufle) : la pile affiche 2 × la charge réelle. */
  poulie?: 2;
}

export interface Salle {
  id: string;
  nom: string;
  /** Par identifiant d'exercice. */
  machines: Record<string, Montage>;
}

interface Fichier { format: number; salles: Salle[] }

const CHEMIN = "salles.json";
/** Nommée dans la langue du moment ; une fois écrite dans salles.json, c'est un nom comme un autre. */
const premiere = (): Salle => ({ id: "salle-1", nom: t.salleDefaut, machines: {} });

/** Jamais vide : sans fichier, une salle « Ma salle » sans réglage. */
export async function lireSalles(): Promise<Salle[]> {
  const f = await lireJson<Fichier>(CHEMIN, () => ({ format: FORMAT, salles: [premiere()] }));
  return f.salles.length ? f.salles : [premiere()];
}

export const ecrireSalles = (salles: Salle[]) => ecrireJson(CHEMIN, { format: FORMAT, salles } as Fichier);

/** Salle d'une séance ; une séance d'avant les salles (sans `salle`) compte dans la première. */
export const salleDe = (salles: Salle[], s: Seance): Salle =>
  salles.find((x) => x.id === s.salle) ?? salles[0];

/** Salle proposée pour une nouvelle séance : celle de la dernière séance. */
export const salleRetenue = (salles: Salle[], passees: Seance[]): Salle =>
  salleDe(salles, passees[passees.length - 1] ?? { debut: "", exercices: [] });

/** Réglage utile d'une machine : poids à vide sur une machine à disques, moufle sur une poulie. */
export function montage(salle: Salle, e: Exercice): Montage {
  const m = salle.machines[e.id] ?? {};
  if (e.disques && m.aVide) return { aVide: m.aVide };
  if (e.charge === "poulie" && m.poulie === 2) return { poulie: 2 };
  return {};
}

/** Exercice monté dans une salle : les calculs (programme.ts) lisent `aVide` et `poulie`. */
export function exerciceEn(salle: Salle, id: string): Exercice {
  const e = exercice(id);
  const m = montage(salle, e);
  return m.aVide || m.poulie ? { ...e, ...m } : e;
}

/**
 * Montage dans lequel une séance a été notée. Avant les salles, une poulie double était notée en
 * charge réelle (la pile ÷ 2) : ces séances ne prennent pas la moufle de la salle, seulement le
 * poids à vide.
 */
function montageDe(salles: Salle[], s: Seance, e: Exercice): Montage {
  const m = montage(salleDe(salles, s), e);
  return s.salle === undefined ? { aVide: m.aVide } : m;
}

const facteur = (m: Montage) => m.poulie ?? 1;
const nul = (m: Montage) => !m.aVide && facteur(m) === 1;

/**
 * Séances réécrites (en mémoire) dans les unités d'une salle : charge réelle = lue ÷ moufle + à vide,
 * puis rendue comme elle se lirait dans `vers`. Sans `vers`, unités neutres (charge réelle, sans
 * chariot retiré) : celles des stats et du résumé. Les séances déjà dans les bonnes unités sont
 * rendues telles quelles.
 */
export function normaliser(seances: Seance[], salles: Salle[], vers?: Salle): Seance[] {
  return seances.map((s) => {
    let change = false;
    const exercices = s.exercices.map((x) => {
      const e = exercice(x.exo);
      const de = montageDe(salles, s, e);
      const a = vers ? montage(vers, e) : {};
      if ((nul(de) && nul(a)) || (de.aVide === a.aVide && facteur(de) === facteur(a))) return x;
      change = true;
      const conv = (kg: number) => Math.round(((kg / facteur(de) + (de.aVide ?? 0) - (a.aVide ?? 0)) * facteur(a)) * 100) / 100;
      return { ...x, series: x.series.map((v) => ({ ...v, kg: conv(v.kg), ...(v.prevu ? { prevu: { ...v.prevu, kg: conv(v.prevu.kg) } } : {}) })) };
    });
    return change ? { ...s, exercices } : s;
  });
}
