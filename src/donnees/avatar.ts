import type { Stats } from "./stats";

/**
 * Personnage en pixel art (docs/stats.md, « Personnage ») : chaque trait lit un palier d'une stat
 * calculée, il redescend quand la stat baisse. Rien ne se débloque ni ne s'achète.
 */

/** Seuils de passage au palier suivant ; palier = nombre de seuils atteints. */
export const SEUILS = {
  force: [40, 55, 70, 85],
  endurance: [25, 50, 75],
  constance: [50, 75],
} as const;

export type Trait = keyof typeof SEUILS;
export type Paliers = Record<Trait, number>;

/** Ce que chaque palier change, du palier 1 au dernier (index = palier − 1). */
export const EFFETS: Record<Trait, string[]> = {
  force: ["épaules plus larges", "bras plus épais, pectoraux", "biceps, jambes plus épaisses", "carrure maximale"],
  endurance: ["taille affinée", "ligne d'abdos", "abdos dessinés"],
  constance: ["posture droite, teint vif", "halo"],
};

/** Une stat absente (Force sans pesée) compte pour 0. */
export const palier = (t: Trait, valeur: number | undefined) =>
  SEUILS[t].filter((s) => (valeur ?? 0) >= s).length;

export const paliers = (s: Stats): Paliers => ({
  force: palier("force", s.force),
  endurance: palier("endurance", s.endurance),
  constance: palier("constance", s.constance),
});

/** Seuil du prochain palier (`undefined` au dernier) et seuil sous lequel on perd l'actuel (`undefined` au palier 0). */
export function bornes(t: Trait, valeur: number | undefined): { suivant?: number; perte?: number } {
  const p = palier(t, valeur);
  return { suivant: SEUILS[t][p], perte: p ? SEUILS[t][p - 1] : undefined };
}

/** Couleurs du sprite, résolues en variables CSS par l'écran. */
export const Px = { Vide: 0, Peau: 1, Cheveux: 2, Yeux: 3, Short: 4, Ombre: 5, Chaussures: 6 } as const;
export type Px = (typeof Px)[keyof typeof Px];

export const LARGEUR = 24;
export const HAUTEUR = 27;

/** Bande horizontale d'une même couleur : un rectangle SVG au lieu d'un par pixel. */
export interface Bande { x: number; y: number; l: number; c: Px }

/** Grille du personnage, symétrique, `HAUTEUR` lignes de `LARGEUR` pixels. */
export function grille({ force: f, endurance: e, constance: c }: Paliers): Px[][] {
  const g: Px[][] = Array.from({ length: HAUTEUR }, () => Array<Px>(LARGEUR).fill(Px.Vide));
  // Coordonnées sur une demi-largeur de 11 (x de 0 à 10, axe entre 10 et 11), décalées d'un pixel
  // pour laisser la place aux bras du dernier palier de Force.
  const pose = (x: number, y: number, v: Px) => {
    if (x < -1 || x > 10 || y < 0 || y >= HAUTEUR) return;
    g[y][x + 1] = v;
    g[y][LARGEUR - 2 - x] = v;
  };
  const bloc = (demi: number, y0: number, y1: number, v: Px) => {
    for (let y = y0; y <= y1; y++) for (let x = 11 - demi; x <= 10; x++) pose(x, y, v);
  };
  // Constance 0 : tête rentrée d'un pixel (dos rond), cernes.
  const o = c === 0 ? 1 : 0;
  bloc(2, o, o, Px.Cheveux);
  bloc(3, 1 + o, 2 + o, Px.Cheveux);
  bloc(3, 3 + o, 6 + o, Px.Peau);
  bloc(2, 7 + o, 7 + o, Px.Peau);
  pose(9, 4 + o, Px.Yeux);
  if (c === 0) pose(9, 5 + o, Px.Ombre);
  bloc(f >= 2 ? 2 : 1, 8 + o, 8 + o, Px.Peau);

  // Torse : épaules arrondies (Force), poitrine sur 3 lignes, puis trapèze jusqu'à la taille (Endurance).
  const haut = 9 + o, epaules = 4 + f, taille = [5, 4, 3, 3][e];
  bloc(epaules - 1, haut, haut, Px.Peau);
  bloc(epaules, haut + 1, haut + 3, Px.Peau);
  for (let y = haut + 4; y <= 16; y++) {
    bloc(Math.round(epaules - ((epaules - taille) * (y - haut - 3)) / (16 - haut - 3)), y, y, Px.Peau);
  }
  if (f >= 2) for (let x = 12 - epaules; x <= 10; x++) pose(x, haut + 3, Px.Ombre);
  // Abdos : ligne centrale, puis une barre de chaque côté.
  if (e >= 2) for (let y = 14; y <= 16; y++) pose(10, y, Px.Ombre);
  if (e >= 3) for (const x of [8, 9]) pose(x, 15, Px.Ombre);

  // Bras collés à l'épaule ; décollés d'un pixel au palier 0 ou si la taille dépasse les épaules,
  // sinon ils se fondent dans le torse. Haut du bras plus épais à Force 2, biceps à Force 3.
  const brasHaut = f >= 2 ? 2 : 1, avantBras = f >= 3 ? 2 : 1;
  const bras = Math.max(epaules + (f === 0 ? 1 : 0), taille + 1);
  for (let y = haut + 1; y <= 17; y++) {
    const biceps = f >= 3 && y >= haut + 2 && y <= haut + 3 ? 1 : 0;
    const l = y <= haut + 4 ? brasHaut + biceps : avantBras;
    for (let i = 0; i < l; i++) pose(10 - bras - i, y, Px.Peau);
  }

  bloc(Math.max(taille, 4), 17, 19, Px.Short);
  const jambe = f >= 3 ? 3 : 2;
  for (let y = 20; y <= 24; y++) for (let x = 10 - jambe; x <= 9; x++) pose(x, y, Px.Peau);
  for (let y = 25; y <= 26; y++) for (let x = 9 - jambe; x <= 9; x++) pose(x, y, Px.Chaussures);
  return g;
}

export function bandes(g: Px[][]): Bande[] {
  const res: Bande[] = [];
  g.forEach((ligne, y) => {
    for (let x = 0; x < ligne.length; ) {
      let l = 1;
      while (x + l < ligne.length && ligne[x + l] === ligne[x]) l++;
      if (ligne[x] !== Px.Vide) res.push({ x, y, l, c: ligne[x] });
      x += l;
    }
  });
  return res;
}
