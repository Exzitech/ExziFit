import { t } from "../i18n";
import { exercice } from "./exercices";
import { dater, ecrireJson, FORMAT, lireJson } from "./fichier";
import { poserProgrammesPerso, PROGRAMMES, type Jour, type Programme } from "./programme";

/**
 * Programmes écrits dans l'app (docs/modele-donnees.md, « programmes.json ») : une rotation de
 * jours, sans périodisation (une seule semaine répétée), accessoires en double progression.
 * L'éditeur ne choisit que les jours, leur objectif, les exos, leur nombre de séries et leur repos ;
 * le reste vient de l'objectif.
 */
export const PROGRAMMES_PERSO = "programmes.json";

export type Objectif = "force" | "hypertrophie" | "endurance";

interface Reglage { series: number; repsMin: number; repsMax: number; repos: number }

/**
 * Le premier exo du jour est le principal (échauffement calculé, plus de repos) ; RIR 2 partout,
 * le bas de « 1 à 2 RIR ». Accessoires de force en 3 × 8–10, comme ceux du Bloc Force.
 */
export const OBJECTIFS: Record<Objectif, { principal: Reglage; accessoire: Reglage }> = {
  force: {
    principal: { series: 4, repsMin: 4, repsMax: 6, repos: 180 },
    accessoire: { series: 3, repsMin: 8, repsMax: 10, repos: 120 },
  },
  hypertrophie: {
    principal: { series: 4, repsMin: 6, repsMax: 8, repos: 150 },
    accessoire: { series: 3, repsMin: 8, repsMax: 12, repos: 90 },
  },
  endurance: {
    principal: { series: 3, repsMin: 12, repsMax: 15, repos: 90 },
    accessoire: { series: 3, repsMin: 15, repsMax: 20, repos: 60 },
  },
};
const RIR = 2;

/** Ce que l'éditeur manipule. `series`, `repos` absents = ceux de l'objectif ; `id` absent = jour nouveau. */
export interface ExoBrouillon { exo: string; series?: number; repos?: number }
export interface JourBrouillon { id?: string; nom: string; objectif: Objectif; exos: ExoBrouillon[] }
/** `dernierJour` : plus grand `J<n>` déjà attribué, pour qu'un jour retiré ne prête jamais son id. */
export interface Brouillon { id?: string; nom: string; jours: JourBrouillon[]; dernierJour?: number }

export const estPerso = (id: string) => id.startsWith("perso-");

/** Réglage d'un exo selon sa place dans le jour. */
export const reglageExo = (objectif: Objectif, rang: number, x: ExoBrouillon): Reglage => {
  const r = OBJECTIFS[objectif][rang === 0 ? "principal" : "accessoire"];
  return { ...r, series: x.series ?? r.series, repos: x.repos ?? r.repos };
};

/** Prêt à enregistrer : un nom, au moins un jour, au moins un exo par jour. */
export const brouillonComplet = (b: Brouillon) =>
  b.nom.trim() !== "" && b.jours.length > 0 && b.jours.every((j) => j.exos.length > 0);

/**
 * Programme du brouillon. Les jours gardent leur `id` (les séances passées y renvoient) ; un jour
 * nouveau prend un `J<n>` jamais attribué dans ce programme.
 */
const numero = (id?: string) => Number(id?.slice(1)) || 0;

export function versProgramme(b: Brouillon, id: string): Programme {
  let n = Math.max(b.dernierJour ?? 0, ...b.jours.map((j) => numero(j.id)));
  const jours: Jour[] = b.jours.map((j, i) => ({
    id: j.id ?? `J${++n}`,
    nom: j.nom.trim() || t.editeur.jour(i + 1),
    objectif: j.objectif,
    lourd: j.objectif === "force",
    exercices: j.exos.map((x, rang) => {
      const r = reglageExo(j.objectif, rang, x);
      return {
        exo: exercice(x.exo).id,
        ...(rang === 0 ? { role: "principal" as const } : {}),
        prescription: { type: "fourchette" as const, series: r.series, repsMin: r.repsMin, repsMax: r.repsMax, rir: RIR },
        repos: r.repos,
      };
    }),
  }));
  return {
    id, nom: b.nom.trim(), jours, regles: [], notes: [],
    semaines: [{ nom: "S1", label: "Continu", schemas: {} }],
  };
}

/** Brouillon d'un programme écrit par l'éditeur ; séries ou repos égaux à ceux de l'objectif redeviennent « absents ». */
export function versBrouillon(p: Programme): Brouillon {
  return {
    id: p.id,
    nom: p.nom,
    dernierJour: Math.max(0, ...p.jours.map((j) => numero(j.id))),
    jours: p.jours.map((j) => {
      const objectif: Objectif = j.objectif in OBJECTIFS ? (j.objectif as Objectif) : "hypertrophie";
      const exos = j.exercices.filter((x) => x.exo).map((x, rang) => {
        const series = x.prescription.type === "fourchette" ? x.prescription.series : undefined;
        const defaut = OBJECTIFS[objectif][rang === 0 ? "principal" : "accessoire"];
        return {
          exo: x.exo!,
          ...(series !== undefined && series !== defaut.series ? { series } : {}),
          ...(x.repos !== defaut.repos ? { repos: x.repos } : {}),
        };
      });
      return { id: j.id, nom: j.nom, objectif, exos };
    }),
  };
}

/** Pose au lancement les programmes écrits dans l'app ; fichier absent = aucun. */
export async function chargerProgrammesPerso(): Promise<void> {
  poserProgrammesPerso(await lireProgrammesPerso());
}

/** Le contenu de `programmes.json` ; fichier absent = aucun. */
export async function lireProgrammesPerso(): Promise<Programme[]> {
  const f = await lireJson<{ format: number; programmes: Programme[] }>(PROGRAMMES_PERSO, () => ({ format: FORMAT, programmes: [] }));
  if (!Array.isArray(f.programmes)) throw new Error(`${PROGRAMMES_PERSO} : « programmes » n'est pas une liste`);
  return f.programmes;
}

/** Enregistre un programme (nouveau ou modifié, daté par `dater`) et le rend disponible tout de suite. */
export async function enregistrerProgramme(p: Programme): Promise<void> {
  const perso = PROGRAMMES.filter((x) => estPerso(x.id));
  const i = perso.findIndex((x) => x.id === p.id);
  const l = dater(await lireProgrammesPerso(), i < 0 ? [...perso, p] : perso.map((x) => (x.id === p.id ? p : x)), new Date());
  await ecrireJson(PROGRAMMES_PERSO, { format: FORMAT, programmes: l });
  poserProgrammesPerso(l);
}

/** Identifiant d'un programme nouveau : unique sans compteur à stocker. */
export const nouvelId = (maintenant: Date) => `perso-${maintenant.getTime().toString(36)}`;
