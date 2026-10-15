import { describe, expect, it } from "vitest";
import type { Seance, Serie } from "./journal";
import { cible, echauffement, recalage, retour, rmEffectif } from "./programme";
import { exerciceEn, normaliser, salleRetenue, type Salle } from "./salles";

const t = (kg: number, reps: number, rir?: number): Serie => ({ type: "travail", kg, reps, rir });
const ici: Salle = { id: "ici", nom: "Ici", machines: { "presse-cuisses": { aVide: 76 }, "extension-triceps-poulie-haute": { poulie: 2 } } };
const la: Salle = { id: "la", nom: "Là", machines: { "presse-cuisses": { aVide: 50 } } };
const salles = [ici, la];
const seance = (salle: string | undefined, exo: string, series: Serie[], poulie?: 2): Seance =>
  ({ debut: "2026-10-10T18:00", ...(salle ? { salle } : {}), ...(poulie ? { poulie } : {}), exercices: [{ exo, series }] });
const kgs = (s: Seance[]) => s.flatMap((x) => x.exercices.flatMap((e) => e.series.map((v) => v.kg)));

describe("normaliser", () => {
  it("unités neutres : disques + chariot, pile ÷ moufle", () => {
    expect(kgs(normaliser([seance("ici", "presse-cuisses", [t(100, 10)])], salles))).toEqual([176]);
    expect(kgs(normaliser([seance("ici", "extension-triceps-poulie-haute", [t(60, 10)])], salles))).toEqual([30]);
  });

  it("d'une salle à l'autre : même total, autres disques", () => {
    expect(kgs(normaliser([seance("ici", "presse-cuisses", [t(100, 10)])], salles, la))).toEqual([126]);
  });

  it("séance d'avant les salles : chariot de la première salle, moufle déjà retirée", () => {
    // Avant les salles, la poulie double était notée en charge réelle (30 = pile à 60).
    expect(kgs(normaliser([seance(undefined, "extension-triceps-poulie-haute", [t(30, 10)], 2)], salles, ici))).toEqual([60]);
    expect(kgs(normaliser([seance(undefined, "presse-cuisses", [t(100, 10)])], salles))).toEqual([176]);
  });

  it("déjà dans les bonnes unités : même objet", () => {
    const s = [seance("ici", "presse-cuisses", [t(100, 10)])];
    expect(normaliser(s, salles, ici)[0]).toBe(s[0]);
  });

  it("salle retenue = celle de la dernière séance, sinon la première", () => {
    expect(salleRetenue(salles, [seance("la", "presse-cuisses", [])]).id).toBe("la");
    expect(salleRetenue(salles, []).id).toBe("ici");
  });
});

describe("calculs avec le chariot", () => {
  const presse = exerciceEn(ici, "presse-cuisses");

  it("1RM estimé et % sur le total, charge rendue en disques", () => {
    // 100 + 76 = 176 × 5 à 1 RIR → 211,2.
    expect(rmEffectif(presse, [seance("ici", "presse-cuisses", [t(100, 5, 1)])], undefined, undefined)).toBeCloseTo(211.2, 1);
    const pr = { type: "rpe" as const, series: 3, reps: 5, rpe: 9 };
    // Même 5 reps à 1 RIR → mêmes disques ; sans chariot, Epley les aurait déjà comptés.
    expect(cible(presse, pr, { semaine: { nom: "", label: "", schemas: {} }, passees: [seance("ici", "presse-cuisses", [t(100, 5, 1)])] }).kg).toBe(100);
  });

  it("recalage et retour sur le total : 2 RIR de plus monte plus qu'en disques seuls", () => {
    // 176 × 5 à 3 RIR → 5 à 1 RIR : 176 × 1,2667 / 1,2 = 185,8 → 109,8 → 110 de disques.
    expect(recalage(presse, t(100, 5, 3), 5, 1, undefined, false)).toBe(110);
    // −10 % de 176 = 158,4 → 82,4 → 80 de disques.
    expect(retour(presse, 100)).toBe(80);
  });

  it("échauffement en % du total, sans palier sous le chariot", () => {
    // Total 176 : 40 % = 70 sous le chariot (retiré), 60 % = 105,6 → 30, 75 % = 132 → 55.
    expect(echauffement(presse, 100)).toEqual(["À vide ×10", "30 ×3", "55 ×2"]);
  });

  it("poulie double : la pile affiche le double", () => {
    const pushdown = exerciceEn(ici, "extension-triceps-poulie-haute");
    expect(retour(pushdown, 60)).toBe(55);
  });
});
