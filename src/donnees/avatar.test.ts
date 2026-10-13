import { describe, expect, it } from "vitest";
import { bandes, bornes, grille, HAUTEUR, LARGEUR, palier, paliers, Px, SEUILS, type Paliers } from "./avatar";

const largeurMax = (g: Px[][]) => Math.max(...g.map((l) => l.filter((v) => v !== Px.Vide).length));
const peau = (g: Px[][]) => g.flat().filter((v) => v === Px.Peau || v === Px.Ombre).length;

describe("paliers", () => {
  it("un seuil atteint fait passer au palier suivant, juste en dessous non", () => {
    expect(palier("force", 54.9)).toBe(1);
    expect(palier("force", 55)).toBe(2);
    expect(palier("force", 140)).toBe(SEUILS.force.length);
    expect(palier("constance", 0)).toBe(0);
  });

  it("Force sans pesée = palier 0", () => {
    expect(paliers({ endurance: 60, constance: 75, groupes: {} as never })).toEqual({ force: 0, endurance: 2, constance: 2 });
  });

  it("bornes : prochain seuil et seuil de perte", () => {
    expect(bornes("force", 62)).toEqual({ suivant: 70, perte: 55 });
    expect(bornes("force", 10)).toEqual({ suivant: 40, perte: undefined });
    expect(bornes("constance", 100)).toEqual({ suivant: undefined, perte: 75 });
  });
});

describe("grille", () => {
  const tous: Paliers[] = [];
  for (let f = 0; f <= 4; f++) for (let e = 0; e <= 3; e++) for (let c = 0; c <= 2; c++) tous.push({ force: f, endurance: e, constance: c });

  it("toujours symétrique et dans le cadre", () => {
    for (const p of tous) {
      const g = grille(p);
      expect(g).toHaveLength(HAUTEUR);
      for (const l of g) {
        expect(l).toHaveLength(LARGEUR);
        expect(l).toEqual([...l].reverse());
      }
    }
  });

  it("chaque palier de Force change la silhouette, en plus large ou plus épais", () => {
    for (let f = 0; f < 4; f++) {
      const a = grille({ force: f, endurance: 1, constance: 1 });
      const b = grille({ force: f + 1, endurance: 1, constance: 1 });
      expect(largeurMax(b) >= largeurMax(a) && peau(b) > peau(a)).toBe(true);
    }
  });

  it("chaque palier d'Endurance change le torse", () => {
    for (let e = 0; e < 3; e++) {
      expect(grille({ force: 2, endurance: e, constance: 1 })).not.toEqual(grille({ force: 2, endurance: e + 1, constance: 1 }));
    }
  });

  it("Constance 0 : la tête descend d'un pixel", () => {
    expect(grille({ force: 1, endurance: 1, constance: 0 })[0].some((v) => v !== Px.Vide)).toBe(false);
    expect(grille({ force: 1, endurance: 1, constance: 1 })[0].some((v) => v !== Px.Vide)).toBe(true);
  });

  it("les bandes redonnent la grille", () => {
    const g = grille({ force: 3, endurance: 2, constance: 2 });
    const r: Px[][] = Array.from({ length: HAUTEUR }, () => Array<Px>(LARGEUR).fill(Px.Vide));
    for (const b of bandes(g)) for (let i = 0; i < b.l; i++) r[b.y][b.x + i] = b.c;
    expect(r).toEqual(g);
  });
});
