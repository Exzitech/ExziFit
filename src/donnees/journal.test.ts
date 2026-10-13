import { describe, expect, it } from "vitest";
import { exercice } from "./exercices";
import { ajusterKg, historique, proposition, type Seance } from "./journal";

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
