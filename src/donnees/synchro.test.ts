import { describe, expect, it } from "vitest";
import type { Bloc } from "./bloc";
import type { Seance } from "./journal";
import { fusionner, type Etat } from "./synchro";

const etat = (e: Partial<Etat>): Etat => ({ format: 1, seances: [], suppressions: [], blocs: [], pesees: [], programmes: [], salles: [], profil: null, ...e });
const seance = (debut: string, kg: number, modifie?: string): Seance => ({
  debut, fin: debut.replace("T18", "T19"), exercices: [{ exo: "developpe-couche", series: [{ type: "travail", kg, reps: 5 }] }],
  ...(modifie ? { modifie } : {}),
});
const kg = (e: Etat) => e.seances.map((s) => [s.debut.slice(0, 10), s.exercices[0].series[0].kg]);

describe("fusionner", () => {
  it("réunit les séances des deux appareils, triées", () => {
    const tel = etat({ seances: [seance("2026-10-14T18:00:00+02:00", 100)] });
    const pc = etat({ seances: [seance("2026-10-12T18:00:00+02:00", 95)] });
    expect(kg(fusionner(tel, pc))).toEqual([["2026-10-12", 95], ["2026-10-14", 100]]);
  });

  it("une correction l'emporte sur la séance d'origine, dans les deux sens", () => {
    const origine = seance("2026-10-14T18:00:00+02:00", 100);
    const corrigee = seance("2026-10-14T18:00:00+02:00", 102.5, "2026-10-15T09:00:00+02:00");
    const a = etat({ seances: [origine] });
    const b = etat({ seances: [corrigee] });
    expect(kg(fusionner(a, b))).toEqual([["2026-10-14", 102.5]]);
    expect(fusionner(b, a)).toEqual(fusionner(a, b));
  });

  it("deux corrections : la plus récente gagne", () => {
    const d = "2026-10-14T18:00:00+02:00";
    const a = etat({ seances: [seance(d, 101, "2026-10-15T09:00:00+02:00")] });
    const b = etat({ seances: [seance(d, 103, "2026-10-15T10:00:00+02:00")] });
    expect(kg(fusionner(a, b))).toEqual([["2026-10-14", 103]]);
  });

  it("une suppression retire la séance de l'autre appareil, sauf corrigée après", () => {
    const d = "2026-10-14T18:00:00+02:00";
    const pc = etat({ suppressions: [{ debut: d, le: "2026-10-15T09:00:00+02:00" }] });
    expect(fusionner(etat({ seances: [seance(d, 100)] }), pc).seances).toEqual([]);
    const corrigeeApres = etat({ seances: [seance(d, 100, "2026-10-15T10:00:00+02:00")] });
    expect(kg(fusionner(corrigeeApres, pc))).toEqual([["2026-10-14", 100]]);
    expect(fusionner(corrigeeApres, pc).suppressions).toHaveLength(1);
  });

  it("blocs par id (modifié le plus récent), pesées par jour (saisie la plus récente)", () => {
    const bloc = (rm: number, modifie?: string): Bloc =>
      ({ id: "b1", programme: "bloc-force", debut: "2026-10-05", fin: null, rm: { "developpe-couche": rm }, ...(modifie ? { modifie } : {}) });
    const a = etat({ blocs: [bloc(120)], pesees: [{ date: "2026-10-14", kg: 80, le: "2026-10-14T07:00:00+02:00" }] });
    const b = etat({
      blocs: [bloc(125, "2026-10-14T20:00:00+02:00")],
      pesees: [{ date: "2026-10-14", kg: 79.5, le: "2026-10-14T08:00:00+02:00" }, { date: "2026-10-10", kg: 81 }],
    });
    const f = fusionner(a, b);
    expect(f.blocs.map((x) => x.rm["developpe-couche"])).toEqual([125]);
    expect(f.pesees.map((x) => [x.date, x.kg])).toEqual([["2026-10-10", 81], ["2026-10-14", 79.5]]);
  });

  it("égalité parfaite de date : les deux appareils choisissent la même version", () => {
    const d = "2026-10-14T18:00:00+02:00";
    const a = etat({ seances: [seance(d, 100)] });
    const b = etat({ seances: [seance(d, 110)] });
    expect(fusionner(a, b)).toEqual(fusionner(b, a));
  });

  it("idempotente : refusionner ne change plus rien", () => {
    const a = etat({ seances: [seance("2026-10-14T18:00:00+02:00", 100)], pesees: [{ date: "2026-10-14", kg: 80 }] });
    const b = etat({ seances: [seance("2026-10-12T18:00:00+02:00", 95)] });
    const f = fusionner(a, b);
    expect(fusionner(f, a)).toEqual(f);
    expect(fusionner(f, b)).toEqual(f);
  });

  it("salles : la plus récente par id, même ordre des deux côtés (salle-2 avant salle-10)", () => {
    const salle = (id: string, nom: string, modifie?: string) => ({ id, nom, machines: {}, ...(modifie ? { modifie } : {}) });
    const tel = etat({ salles: [salle("salle-1", "Basic-Fit", "2026-10-16T10:00:00+02:00"), salle("salle-10", "Hôtel")] });
    const pc = etat({ salles: [salle("salle-2", "Travail"), salle("salle-1", "Ma salle")] });
    const f = fusionner(tel, pc);
    expect(f).toEqual(fusionner(pc, tel));
    expect(f.salles.map((s) => s.nom)).toEqual(["Basic-Fit", "Travail", "Hôtel"]);
  });
});
