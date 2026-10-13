import { describe, expect, it } from "vitest";
import { exercice } from "./exercices";
import { ajusterKg, corrigerListe, facteurPoulie, historique, poulieRetenue, proposition, type Seance } from "./journal";

const bench = exercice("developpe-couche");
const t = (kg: number, reps: number) => ({ type: "travail" as const, kg, reps });

const seance = (debut: string, ...exos: [string, ReturnType<typeof t>[]][]): Seance => ({
  debut, exercices: exos.map(([exo, series]) => ({ exo, series })),
});

const passees = [
  seance("2026-10-01T18:00:00+02:00", ["developpe-couche", [t(100, 5), t(100, 5), t(95, 5)]]),
  seance("2026-10-03T18:00:00+02:00", ["hack-squat", [t(140, 8)]]),
  seance("2026-10-05T18:00:00+02:00", ["developpe-couche", [t(102.5, 5), t(102.5, 4)]]),
];

describe("proposition", () => {
  it("1re série du jour : 1re série de la dernière fois, pas la dernière dégradée", () => {
    expect(proposition(passees, seance("2026-10-07T18:00:00+02:00"), bench)).toEqual({ kg: 102.5, reps: 5 });
  });
  it("séries suivantes : la précédente du jour, correction comprise", () => {
    const enCours = seance("2026-10-07T18:00:00+02:00", ["developpe-couche", [t(105, 5)]]);
    expect(proposition(passees, enCours, bench)).toEqual({ kg: 105, reps: 5 });
  });
  it("les échauffements ne comptent pas", () => {
    const enCours: Seance = {
      debut: "2026-10-07T18:00:00+02:00",
      exercices: [{ exo: "developpe-couche", series: [{ type: "echauffement", kg: 60, reps: 5 }] }],
    };
    expect(proposition(passees, enCours, bench)).toEqual({ kg: 102.5, reps: 5 });
  });
  it("jamais fait : barre vide sur une barre, 0 kg ailleurs", () => {
    const vide = seance("2026-10-07T18:00:00+02:00");
    expect(proposition([], vide, bench)).toEqual({ kg: 20, reps: 8 });
    expect(proposition([], vide, exercice("tractions-lestees"))).toEqual({ kg: 0, reps: 8 });
  });
});

describe("historique", () => {
  it("plus récente d'abord, séances sans l'exo ignorées, limitée à n", () => {
    const h = historique(passees, "developpe-couche", 5);
    expect(h.map((x) => x.debut.slice(0, 10))).toEqual(["2026-10-05", "2026-10-01"]);
    expect(historique(passees, "developpe-couche", 1)).toHaveLength(1);
  });
});

describe("ajusterKg", () => {
  it("un pas, arrondi au pas, jamais négatif", () => {
    expect(ajusterKg(100, 2.5, 1)).toBe(102.5);
    expect(ajusterKg(11.25, 1.25, -1)).toBe(10);
    expect(ajusterKg(61, 2.5, 1)).toBe(62.5);
    expect(ajusterKg(1, 2.5, -1)).toBe(0);
  });
});

describe("poulie double", () => {
  const triceps = exercice("extension-triceps-poulie-haute");
  const double: Seance = { ...seance("2026-10-10T18:00:00Z", ["extension-triceps-poulie-haute", [t(26, 10)]]), poulie: 2 };
  it("double l'affichage des exos à la poulie seulement", () => {
    expect(facteurPoulie(double, triceps)).toBe(2);
    expect(facteurPoulie(double, bench)).toBe(1);
    expect(facteurPoulie({ ...double, poulie: undefined }, triceps)).toBe(1);
  });
  it("retient le montage de la dernière séance qui a eu un exo à la poulie", () => {
    const sansPoulie = seance("2026-10-12T18:00:00Z", ["developpe-couche", [t(100, 5)]]);
    expect(poulieRetenue([double, sansPoulie])).toEqual({ poulie: 2 });
    const simple = seance("2026-10-11T18:00:00Z", ["face-pull", [t(20, 12)]]);
    expect(poulieRetenue([double, simple, sansPoulie])).toEqual({});
    expect(poulieRetenue([])).toEqual({});
  });
});

describe("corrigerListe", () => {
  const d = passees[1].debut;
  it("remplace la séance visée et garde les autres à leur place", () => {
    const corrigee = seance(d, ["hack-squat", [t(130, 8)]]);
    expect(corrigerListe(passees, d, corrigee)).toEqual([passees[0], corrigee, passees[2]]);
  });
  it("retire la séance supprimée, ou vidée de toutes ses séries", () => {
    expect(corrigerListe(passees, d, null)).toEqual([passees[0], passees[2]]);
    expect(corrigerListe(passees, d, seance(d, ["hack-squat", []]))).toEqual([passees[0], passees[2]]);
  });
  it("retire un exo sans série", () => {
    const res = corrigerListe(passees, d, seance(d, ["hack-squat", [t(140, 8)]], ["face-pull", []]));
    expect(res[1].exercices.map((x) => x.exo)).toEqual(["hack-squat"]);
  });
  it("refuse une séance absente au lieu de ne rien faire", () => {
    expect(() => corrigerListe(passees, "2026-10-02T18:00:00+02:00", null)).toThrow("introuvable");
  });
});
