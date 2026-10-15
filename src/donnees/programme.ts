import { exercice, type Exercice, type Muscle } from "./exercices";
import { historique, type Seance, type Serie } from "./journal";
import blocForce from "./programmes/bloc-force.json";
import endurance from "./programmes/endurance.json";
import pushPullLegs from "./programmes/push-pull-legs.json";
import supersetExpress from "./programmes/superset-express.json";

/** Types du programme (docs/modele-donnees.md, « Programme »). */
export type Prescription =
  | { type: "pct1rm"; schema: string }
  | { type: "fourchette"; series: number; repsMin: number; repsMax: number; rir?: number }
  | { type: "rpe"; series: number; reps: number; rpe: number }
  | { type: "distance"; series: number; metres: number };

export interface Schema { series: number; reps: number; pct: number[] }

export interface Semaine {
  nom: string;
  label: string;
  schemas: Record<string, Schema>;
  test?: Record<string, number>;
}

/** Une ligne d'un jour : un exercice, ou un superset de plusieurs. */
export interface Poste {
  exo?: string;
  superset?: string[];
  role?: "principal";
  prescription: Prescription;
  repos: number;
  optionnel?: boolean;
  note?: string;
  alternatives?: string[];
}

export interface Jour {
  id: string;
  nom: string;
  objectif: string;
  lourd: boolean;
  optionnel?: boolean;
  note?: string;
  exercices: Poste[];
}

export interface Programme {
  id: string;
  nom: string;
  semaines: Semaine[];
  jours: Jour[];
  regles: ({ type: "ecart"; exos: string[]; heures: number } | { type: "max-lourds-consecutifs"; jours: number })[];
  notes: string[];
}

/**
 * Programmes proposés, dans le code tant qu'il n'y a pas d'éditeur (le modèle prévoit
 * `programmes.json` le jour où Tom en écrit un depuis l'app).
 */
export const PROGRAMMES: Programme[] = [blocForce, pushPullLegs, endurance, supersetExpress]
  .flatMap((f) => (f as unknown as { programmes: Programme[] }).programmes);

/** Programme des séances d'avant le choix du programme (0.1.29 et avant), et choix par défaut. */
export const PROGRAMME_DEFAUT = "bloc-force";

/** Programme par son id ; un id inconnu (programme retiré) retombe sur le défaut. */
export const programme = (id: string | undefined): Programme =>
  PROGRAMMES.find((p) => p.id === id) ?? PROGRAMMES.find((p) => p.id === PROGRAMME_DEFAUT)!;

/** Programme d'une séance de programme ; `undefined` pour une séance libre. */
export const programmeDe = (s: Seance): Programme | undefined =>
  s.jour === undefined ? undefined : programme(s.programme ?? PROGRAMME_DEFAUT);

/** Jour d'une séance dans son programme. */
export const jourDeSeance = (s: Seance): Jour | undefined => programmeDe(s)?.jours.find((j) => j.id === s.jour);

export const membres = (p: Poste): string[] => p.superset ?? [p.exo as string];

/** Exos dont la charge se calcule en % du 1RM du bloc : ceux dont le 1RM se saisit. */
export const exosPct1rm = (p: Programme): string[] => [
  ...new Set(p.jours.flatMap((j) => j.exercices.filter((x) => x.prescription.type === "pct1rm").flatMap(membres))),
];

const JOUR_MS = 86_400_000;
const jourDe = (iso: string) => Math.floor((Date.parse(iso.slice(0, 10)) + 12 * 3_600_000) / JOUR_MS);

/**
 * Jour et semaine proposés : le jour qui suit la dernière séance du bloc. Un jour optionnel est
 * sauté quand les séances lourdes s'enchaînent sur `max-lourds-consecutifs` jours de calendrier
 * jusqu'à hier ou aujourd'hui.
 */
export function prochainJour(p: Programme, seances: Seance[], bloc: string, maintenant: Date): number {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  if (!derniere) return 0;
  let i = (p.jours.findIndex((j) => j.id === derniere.jour) + 1) % p.jours.length;
  const max = p.regles.find((r) => r.type === "max-lourds-consecutifs");
  if (p.jours[i].optionnel && max && lourdsDAffilee(p, duBloc, maintenant) >= max.jours) {
    i = (i + 1) % p.jours.length;
  }
  return i;
}

function lourdsDAffilee(p: Programme, seances: Seance[], maintenant: Date): number {
  const lourds = new Set(
    seances.filter((s) => p.jours.find((j) => j.id === s.jour)?.lourd).map((s) => jourDe(s.debut)),
  );
  // Fuseau local : `maintenant` en date locale, comme les horodatages du journal.
  const local = new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60_000).toISOString();
  let d = jourDe(local);
  if (!lourds.has(d)) d--;
  let n = 0;
  while (lourds.has(d - n)) n++;
  return n;
}

/**
 * Semaine de la séance qui commence par le jour `jour` : celle de la dernière séance du bloc,
 * plus une si la rotation a fait le tour (jour choisi pas après le dernier fait).
 */
export function semaineDe(p: Programme, seances: Seance[], bloc: string, jour: number): number {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  if (!derniere) return 0;
  const sem = derniere.semaine ?? 0;
  const tour = jour <= p.jours.findIndex((j) => j.id === derniere.jour);
  return Math.min(sem + (tour ? 1 : 0), p.semaines.length - 1);
}

/**
 * Fin de bloc : la dernière séance du bloc est en dernière semaine et le jour choisi relance la
 * rotation. Le jour choisi ouvre alors un nouveau bloc (`rmNouveauBloc`). Jamais pour un programme
 * d'une seule semaine.
 */
export function blocFini(p: Programme, seances: Seance[], bloc: string, jour: number): boolean {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  // Une seule semaine : elle se répète, le bloc ne finit jamais.
  if (!derniere || p.semaines.length === 1) return false;
  return (derniere.semaine ?? 0) >= p.semaines.length - 1 && jour <= p.jours.findIndex((j) => j.id === derniere.jour);
}

/**
 * Règles `ecart` touchées par un jour : un exo du jour dont un autre exo de la règle a été fait
 * depuis moins de `heures`. Avertissements seulement, rien n'est bloqué (décidé le 2026-10-13).
 */
export function avertissements(p: Programme, jour: Jour, seances: Seance[], maintenant: Date): string[] {
  const duJour = new Set(jour.exercices.flatMap(membres));
  const res: string[] = [];
  for (const r of p.regles) {
    if (r.type !== "ecart") continue;
    for (const x of r.exos.filter((id) => duJour.has(id))) {
      for (const y of r.exos.filter((id) => id !== x)) {
        const s = [...seances].reverse().find((s) => s.exercices.some((e) => e.exo === y && e.series.some((v) => v.type === "travail")));
        if (!s) continue;
        const h = Math.floor((maintenant.getTime() - Date.parse(s.fin ?? s.debut)) / 3_600_000);
        if (h < r.heures) res.push(`${exercice(y).nom} il y a ${h} h : ${r.heures} h conseillées avant ${exercice(x).nom}.`);
      }
    }
  }
  return res;
}

/** 1RM estimé par Epley avec la réserve. */
export const epley = (kg: number, reps: number, rir = 0) => kg * (1 + (reps + rir) / 30);

/** 1RM d'une série (total) : la charge elle-même pour un single à 0 RIR, Epley avec la réserve sinon. */
export const e1rmSerie = (total: number, reps: number, rir: number) => (reps + rir === 1 ? total : epley(total, reps, rir));

export function arrondir(kg: number, pas: number): number {
  return Math.round(Math.round(kg / pas) * pas * 100) / 100;
}

export interface Cible {
  series: number;
  /** Reps visées pour la prochaine série. */
  reps: number;
  /** Charge proposée (lest seul sur un lesté) ; `null` si l'app n'a pas de quoi la calculer. */
  kg: number | null;
  /** « 80 % », « 8–10 reps », « RPE 8 », « 30 m ». */
  texte: string;
}

export interface Contexte {
  semaine: Semaine;
  /** 1RM figé du bloc pour cet exo (corps + lest sur un lesté). */
  rm?: number;
  poidsCorps?: number;
  passees: Seance[];
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace(".", ",");

/**
 * Total → charge à afficher (lest, disques, pile), arrondie au pas ; `null` sans pesée sur un lesté.
 * Inverse de `totalDe`.
 */
function chargeDe(e: Exercice, total: number, poidsCorps?: number): number | null {
  if (e.charge === "poids-corps-leste") return poidsCorps === undefined ? null : Math.max(0, arrondir(total - poidsCorps, e.pas));
  return Math.max(e.charge === "barre" ? 20 : 0, arrondir((total - (e.aVide ?? 0)) * (e.poulie ?? 1), e.pas));
}

/** Corps ajouté à la charge pour Epley : le poids de corps sur un lesté, 0 sinon. */
const corpsDe = (e: Exercice, poidsCorps?: number) => (e.charge === "poids-corps-leste" ? poidsCorps : 0);

/**
 * Charge notée → total soulevé pour les calculs : ÷ moufle, + chariot de la machine, + corps sur un
 * lesté (`corps` = `corpsDe`, déjà vérifié).
 */
const totalDe = (e: Exercice, kg: number, corps: number) => kg / (e.poulie ?? 1) + (e.aVide ?? 0) + corps;

/**
 * Meilleur 1RM estimé d'une liste de séries (corps + lest sur un lesté), Epley avec la réserve ;
 * un single à 0 RIR vaut sa charge (Epley le gonfle de 3 %). Au-delà de 12 reps, Epley ne vaut
 * plus rien : série ignorée. Un RIR « 4+ » ou absent donne un minimum.
 */
function meilleurE1rm(e: Exercice, series: Serie[], poidsCorps?: number): number | undefined {
  const corps = corpsDe(e, poidsCorps);
  if (corps === undefined) return undefined;
  const v = series.filter((s) => s.reps >= 1 && s.reps <= 12).map((s) => e1rmSerie(totalDe(e, s.kg, corps), s.reps, s.rir ?? 0));
  return v.length ? Math.max(...v) : undefined;
}

/**
 * 1RM sur lequel se calculent les % : celui du bloc, relevé (jamais baissé) par le 1RM estimé de
 * la dernière séance du bloc sur cet exo — la surcharge progressive suit les séries réelles, une
 * mauvaise séance ne fait pas reculer les suivantes. Sans 1RM du bloc : estimé de la dernière fois
 * où l'exo a été fait, d'où qu'elle vienne ; `undefined` si jamais fait (calibrage).
 */
export function rmEffectif(
  e: Exercice, passees: Seance[], bloc: string | undefined, rmBloc: number | undefined, poidsCorps?: number,
): number | undefined {
  if (rmBloc === undefined) {
    const der = historique(passees, e.id, 1)[0];
    return der && meilleurE1rm(e, der.series, poidsCorps);
  }
  const der = bloc === undefined ? undefined : historique(passees.filter((s) => s.bloc === bloc), e.id, 1)[0];
  return Math.max(rmBloc, (der && meilleurE1rm(e, der.series, poidsCorps)) ?? 0);
}

// ——— Semaine de test : après les séries prévues du principal, un test de 1RM ou de 3RM.

/** Reps du test pour un exo cette semaine (1 = 1RM, 3 = 3RM), `null` hors semaine de test. */
export const repsTest = (sem: Semaine, exo: string): number | null => sem.test?.[exo] ?? sem.test?.["*"] ?? null;

/**
 * Meilleur résultat des tentatives de test (corps + lest sur un lesté), `undefined` sans tentative
 * réussie. Une tentative à 0 RIR est une mesure : elle prime sur les estimations faites avec de la
 * réserve (Epley surestime : 150 × 1 à 1 RIR donne 160 quand 155 à 0 RIR a été le max).
 */
export function resultatTest(e: Exercice, series: Serie[], poidsCorps?: number): number | undefined {
  const corps = corpsDe(e, poidsCorps);
  if (corps === undefined) return undefined;
  const reussies = series.filter((s) => s.test && s.reps >= 1);
  const mesures = reussies.filter((s) => s.rir === 0);
  const v = (mesures.length ? mesures : reussies).map((s) => e1rmSerie(totalDe(e, s.kg, corps), s.reps, s.rir ?? 0));
  return v.length ? Math.max(...v) : undefined;
}

/**
 * Test d'un exo dans la séance : `null` hors semaine de test ou si l'exo a déjà été testé dans le
 * bloc (le bench du J5, déjà testé au J1). Fini dès une tentative à 0 RIR ou sous les reps visées.
 */
export function etatTest(sem: Semaine, passees: Seance[], bloc: string | undefined, enCours: Seance, exo: string):
  { reps: number; fini: boolean } | null {
  const reps = repsTest(sem, exo);
  const teste = (s: Seance) => s.exercices.some((x) => x.exo === exo && x.series.some((v) => v.test));
  if (reps === null || passees.some((s) => s.bloc === bloc && teste(s))) return null;
  const tentatives = enCours.exercices.filter((x) => x.exo === exo).flatMap((x) => x.series).filter((v) => v.test);
  return { reps, fini: tentatives.some((v) => v.rir === 0 || v.reps < reps) };
}

/** Première tentative : 95 % de la charge max estimée sur `reps` reps (ouverture). */
export function ouvertureTest(e: Exercice, rm: number, reps: number, poidsCorps?: number): number | null {
  return chargeDe(e, (0.95 * rm) / (reps === 1 ? 1 : 1 + reps / 30), poidsCorps);
}

/** 1RM proposé pour le bloc suivant : le résultat du test du bloc, sinon le 1RM effectif. Arrondi au demi-kilo. */
export function rmNouveauBloc(
  e: Exercice, passees: Seance[], bloc: string, rmBloc: number | undefined, poidsCorps?: number,
): number | undefined {
  const tests = passees.filter((s) => s.bloc === bloc).flatMap((s) => s.exercices.filter((x) => x.exo === e.id).flatMap((x) => x.series));
  const v = resultatTest(e, tests, poidsCorps) ?? rmEffectif(e, passees, bloc, rmBloc, poidsCorps);
  return v === undefined ? undefined : arrondir(v, 0.5);
}

/** RIR visé au mouvement principal : « 1 à 2 RIR » du bloc, on vise le bas (2 RIR → on monte). */
export const RIR_PRINCIPAL = 1;

/** RIR visé pour recaler la série suivante en séance ; `null` si la prescription ne se recale pas. */
export function rirVise(pr: Prescription): number | null {
  if (pr.type === "pct1rm") return RIR_PRINCIPAL;
  if (pr.type === "rpe") return 10 - pr.rpe;
  return null;
}

/**
 * Charge de la série suivante d'après la dernière faite : celle qui donne `reps` reps à `rir` RIR
 * (Epley avec la réserve). Plus de réserve que visé → on monte, moins ou série ratée → on baisse.
 * En calibrage (aucune série fiable encore), un « 4+ » ne dit pas jusqu'où monter : palier fixe,
 * +20 % (au moins 8 pas : +20 kg à la barre), +10 % du total sur un lesté où le corps pèse
 * l'essentiel. Prudent près du max : 120 × 5 à 4+ → 145, pas plus.
 * `null` si la dernière série n'a pas de RIR, ou sans pesée sur un lesté.
 */
export function recalage(
  e: Exercice, der: Serie, reps: number, rir: number, poidsCorps: number | undefined, calibrage: boolean,
): number | null {
  const corps = corpsDe(e, poidsCorps);
  if (der.rir === undefined || corps === undefined) return null;
  const total = totalDe(e, der.kg, corps);
  let suivant = epley(total, der.reps, der.rir) / (1 + (reps + rir) / 30);
  if (calibrage && der.rir >= 4) {
    const palier = e.charge === "poids-corps-leste" ? total * 1.1 : Math.max(total * 1.2, total + 8 * e.pas);
    suivant = Math.max(suivant, palier);
  }
  return chargeDe(e, suivant, poidsCorps);
}

/** Charge et reps prescrites pour un exo d'un poste (docs/modele-donnees.md, « Prescriptions »). */
export function cible(e: Exercice, pr: Prescription, c: Contexte): Cible {
  const leste = e.charge === "poids-corps-leste";
  const charge = (total: number) => chargeDe(e, total, c.poidsCorps);
  const derniere = historique(c.passees, e.id, 1)[0]?.series;

  switch (pr.type) {
    case "pct1rm": {
      const s = c.semaine.schemas[pr.schema];
      if (!s) throw new Error(`schéma « ${pr.schema} » absent de la semaine ${c.semaine.nom}`);
      const texte = s.pct.map(pct).join("–") + " %";
      return { series: s.series, reps: s.reps, kg: c.rm === undefined ? null : charge(c.rm * s.pct[0]), texte };
    }
    case "fourchette": {
      const texte = `${pr.repsMin === pr.repsMax ? pr.repsMin : `${pr.repsMin}–${pr.repsMax}`} reps`;
      if (!derniere) return { series: pr.series, reps: pr.repsMin, kg: null, texte };
      // Double progression : toutes les séries en haut de fourchette, réserve tenue → un cran.
      const monte = derniere.length >= pr.series &&
        derniere.every((s) => s.reps >= pr.repsMax && (pr.rir === undefined || (s.rir ?? -1) >= pr.rir));
      const kg = derniere[0].kg;
      if (monte) return { series: pr.series, reps: pr.repsMin, kg: arrondir(kg + e.pas, e.pas), texte };
      const reps = Math.min(pr.repsMax, Math.max(pr.repsMin, derniere[0].reps + 1));
      return { series: pr.series, reps, kg, texte };
    }
    case "rpe": {
      const texte = `RPE ${pr.rpe}`;
      if (!derniere) return { series: pr.series, reps: pr.reps, kg: null, texte };
      const corps = leste ? c.poidsCorps : 0;
      if (corps === undefined) return { series: pr.series, reps: pr.reps, kg: null, texte };
      const e1rm = Math.max(...derniere.map((s) => epley(totalDe(e, s.kg, corps), s.reps, s.rir ?? 0)));
      return { series: pr.series, reps: pr.reps, kg: charge(e1rm / (1 + (pr.reps + 10 - pr.rpe) / 30)), texte };
    }
    case "distance":
      return { series: pr.series, reps: pr.metres, kg: derniere?.[0].kg ?? null, texte: `${pr.metres} m` };
  }
}

/**
 * Charge des séries en plus après une série ratée : −10 % du total (corps + lest sur un lesté,
 * chariot compris sur une machine), arrondi au pas de l'exo. Sans poids de corps, un lesté allège
 * le lest seul.
 */
export function retour(e: Exercice, kg: number, poidsCorps?: number): number {
  const corps = corpsDe(e, poidsCorps);
  if (corps === undefined) return Math.max(0, arrondir(kg * 0.9, e.pas));
  return chargeDe(e, totalDe(e, kg, corps) * 0.9, poidsCorps) as number;
}

/**
 * Mobilité dynamique d'avant séance, au poids du corps (faisable partout, sans matériel), par ordre
 * d'utilité ; chaque mouvement est proposé si un exo du jour travaille un de ses muscles.
 */
const MOBILITE: { texte: string; muscles: Muscle[] }[] = [
  { texte: "Cercles de bras · 10 dans chaque sens", muscles: ["pectoraux", "epaules", "triceps", "biceps", "dos"] },
  { texte: "Squat au poids du corps · 10", muscles: ["quadriceps", "fessiers"] },
  { texte: "Pompes lentes · 8", muscles: ["pectoraux", "triceps"] },
  { texte: "Y-T-W debout, bras tendus · 5 de chaque", muscles: ["dos", "epaules"] },
  { texte: "Good morning mains sur la nuque · 10", muscles: ["ischios", "fessiers"] },
  { texte: "Balancements de jambe · 10 par côté", muscles: ["quadriceps", "ischios", "fessiers"] },
  { texte: "Montées sur pointes · 15", muscles: ["mollets"] },
  { texte: "Cercles de poignets · 10", muscles: ["avant-bras", "biceps"] },
];

/** Plafond de l'échauffement général (demande de Tom) : 5 mouvements de 30 s. */
const MOUVEMENTS_MAX = 5;

/**
 * Échauffement général d'une séance, 3 min au plus et sans matériel : la mobilité des muscles
 * principaux du jour, ≈ 30 s par étape. Pas de cardio : le spécifique (barre à vide ×15 puis les
 * séries d'approche du premier exo, `echauffement`) prépare mieux au lourd et lève le pouls aussi.
 */
export function preparation(exos: Exercice[]): { minutes: number; etapes: string[] } {
  const muscles = new Set(exos.flatMap((e) => e.muscles.principaux));
  const mobilite = MOBILITE.filter((m) => m.muscles.some((x) => muscles.has(x))).map((m) => m.texte).slice(0, MOUVEMENTS_MAX);
  return { minutes: Math.ceil(mobilite.length / 2), etapes: mobilite };
}

/**
 * Échauffement d'un mouvement principal, du plus léger au plus lourd ; vide sous la barre. La barre
 * à vide ×15 tient lieu d'échauffement général ; les paliers lourds restent courts pour ne pas fatiguer.
 */
export function echauffement(e: Exercice, kg: number): string[] {
  if (e.charge === "poids-corps-leste") return kg > 0 ? ["PDC ×5", `+${nombre(arrondir(kg / 2, e.pas))} ×3`] : [];
  const vide = e.charge === "barre" ? "Barre ×15" : "À vide ×15";
  // Les % portent sur le total (chariot compris), puis reviennent en disques.
  const total = totalDe(e, kg, 0);
  const paliers = ([[0.4, 5], [0.6, 3], [0.75, 2]] as const)
    .map(([p, reps]) => [chargeDe(e, total * p) as number, reps] as const)
    .filter(([v], i, l) => v > (e.charge === "barre" ? 20 : 0) && (i === 0 || v > l[i - 1][0]));
  return [vide, ...paliers.map(([v, reps]) => `${nombre(v)} ×${reps}`)];
}

export const DISQUES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Disques par côté sur une barre de 20 kg ; `null` si la charge ne tombe pas juste. */
export function disques(kg: number, barre = 20): number[] | null {
  let reste = Math.round(((kg - barre) / 2) * 100) / 100;
  if (reste < 0) return null;
  const res: number[] = [];
  for (const d of DISQUES) {
    while (reste >= d - 1e-9) {
      res.push(d);
      reste = Math.round((reste - d) * 100) / 100;
    }
  }
  return reste === 0 ? res : null;
}

export const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export interface Bilan {
  minutes: number;
  series: number;
  /** Tonnage des séries de travail (corps + lest sur un lesté ; distances exclues), en kg. */
  volume: number;
  exos: { exo: string; series: Serie[]; record?: { avant: number; apres: number } }[];
}

/**
 * Résumé de fin de séance. Record = meilleur 1RM estimé du jour au-dessus de tous ceux des séances
 * passées sur l'exo ; pas de record la première fois (rien à battre).
 */
export function bilan(s: Seance, passees: Seance[], poidsCorps?: number): Bilan {
  const exos: Bilan["exos"] = [];
  let series = 0;
  let volume = 0;
  for (const x of s.exercices) {
    const e = exercice(x.exo);
    const travail = x.series.filter((v) => v.type === "travail");
    if (!travail.length) continue;
    series += travail.length;
    const corps = corpsDe(e, poidsCorps) ?? 0;
    if (e.charge !== "distance") volume += travail.reduce((t, v) => t + totalDe(e, v.kg, corps) * v.reps, 0);
    // Exo testé : le résultat du test (mesure) prime sur les estimations des autres séries.
    const apres = resultatTest(e, travail, poidsCorps) ?? meilleurE1rm(e, travail, poidsCorps);
    const avant = meilleurE1rm(e, passees.flatMap((p) => p.exercices.filter((y) => y.exo === e.id).flatMap((y) => y.series))
      .filter((v) => v.type === "travail"), poidsCorps);
    exos.push({ exo: e.id, series: travail, ...(apres !== undefined && avant !== undefined && apres > avant ? { record: { avant, apres } } : {}) });
  }
  const minutes = s.fin ? Math.round((Date.parse(s.fin) - Date.parse(s.debut)) / 60_000) : 0;
  return { minutes, series, volume: Math.round(volume), exos };
}

/** Phrases sans chiffre, quand la séance ne bat pas la précédente : jamais de reproche. */
const PHRASES = [
  "Exo bouclé. Bois un coup, on enchaîne.",
  "Propre. Même technique sur le suivant.",
  "Fait. Ce sont les séries comme celle-là qui font le bloc.",
  "Bien tenu. Respire, le suivant attend.",
  "Coché. Une ligne de plus dans le journal.",
  "Solide. Garde ce rythme.",
];

/**
 * Message de fin d'exo, tiré des données : record de 1RM estimé, charge ou reps au-dessus de la
 * dernière fois ; sinon une phrase choisie par `graine` (stable d'un rendu à l'autre).
 */
export function encouragement(e: Exercice, series: Serie[], passees: Seance[], graine: string, poidsCorps?: number): string {
  const travail = series.filter((s) => s.type === "travail");
  const avant = passees.flatMap((p) => p.exercices.filter((x) => x.exo === e.id).flatMap((x) => x.series)).filter((s) => s.type === "travail");
  const apresRm = meilleurE1rm(e, travail, poidsCorps);
  const avantRm = meilleurE1rm(e, avant, poidsCorps);
  if (apresRm !== undefined && avantRm !== undefined && apresRm > avantRm) {
    return `Record : 1RM estimé ${nombre(Math.round(apresRm))} kg (avant ${nombre(Math.round(avantRm))}).`;
  }
  const derniere = [...passees].reverse().find((p) => p.exercices.some((x) => x.exo === e.id));
  const dernieres = derniere ? derniere.exercices.filter((x) => x.exo === e.id).flatMap((x) => x.series).filter((s) => s.type === "travail") : [];
  if (travail.length && dernieres.length && e.charge !== "distance") {
    const haut = (l: Serie[]) => Math.max(...l.map((s) => s.kg));
    const ecart = haut(travail) - haut(dernieres);
    if (ecart > 0) return `+${nombre(ecart)} kg par rapport à la dernière fois.`;
    const reps = (l: Serie[]) => l.reduce((t, s) => t + s.reps, 0);
    const plus = reps(travail) - reps(dernieres);
    if (ecart === 0 && plus > 0) return `${plus} rep${plus > 1 ? "s" : ""} de plus que la dernière fois.`;
  }
  let h = 0;
  for (const c of graine) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PHRASES[h % PHRASES.length];
}
