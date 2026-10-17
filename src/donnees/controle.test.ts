import { describe, expect, it } from "vitest";
import { controlerFichier } from "./controle";

const serie = { type: "travail", kg: 100, reps: 5, rir: 2, prevu: { kg: 100, reps: 5 }, a: "2026-10-14T18:05:00+02:00" };
const seance = (x: object = {}) => ({
  debut: "2026-10-14T18:00:00+02:00", fin: "2026-10-14T19:00:00+02:00",
  exercices: [{ exo: "developpe-couche", series: [serie] }], ...x,
});
const journal = (...seances: object[]) => JSON.stringify({ format: 1, seances });
const J = "journal/2026-10.json";

describe("controlerFichier", () => {
  it("rien à redire sur des données saines", () => {
    expect(controlerFichier(J, journal(seance()))).toEqual([]);
    expect(controlerFichier("en-cours.json", JSON.stringify({ format: 1, seance: null }))).toEqual([]);
    expect(controlerFichier("en-cours.json", JSON.stringify({ format: 1, seance: seance({ fin: undefined, exercices: [] }) }))).toEqual([]);
    expect(controlerFichier("reglages.json", JSON.stringify({ format: 1, theme: "braise" }))).toEqual([]);
  });

  it("NaN et Infinity, écrits null par JSON.stringify", () => {
    const pb = controlerFichier(J, journal(seance({ exercices: [{ exo: "developpe-couche", series: [{ ...serie, kg: NaN, rir: Infinity }] }] })));
    expect(pb).toHaveLength(2);
    expect(pb[0]).toContain("developpe-couche), série 1 : charge null");
    expect(pb[1]).toContain("RIR null");
  });

  it("reps négatives ou décimales, charge négative", () => {
    const pb = controlerFichier(J, journal(seance({ exercices: [{ exo: "x", series: [{ ...serie, reps: -3 }, { ...serie, reps: 2.5, kg: -10 }] }] })));
    expect(pb.map((p) => p.split(" : ")[1])).toEqual(["reps -3", "charge -10", "reps 2.5"]);
  });

  it("séance terminée sans série, fin avant le début, mauvais mois", () => {
    expect(controlerFichier(J, journal(seance({ exercices: [{ exo: "x", series: [] }] })))[0]).toContain("séance sans série");
    expect(controlerFichier(J, journal(seance({ fin: "2026-10-14T17:00:00+02:00" })))[0]).toContain("fin");
    expect(controlerFichier("journal/2026-09.json", journal(seance()))[0]).toContain("hors du mois");
  });

  it("autres fichiers : pesée, 1RM, poids à vide, format, JSON cassé", () => {
    expect(controlerFichier("poids.json", JSON.stringify({ format: 1, pesees: [{ date: "2026-10-01", kg: 0 }] }))).toHaveLength(1);
    expect(controlerFichier("blocs.json", JSON.stringify({ format: 1, blocs: [{ id: "b", rm: { squat: null, dc: 120 } }] }))).toEqual([
      "blocs.json bloc 1 (b) : 1RM squat null",
    ]);
    expect(controlerFichier("salles.json", JSON.stringify({ format: 1, salles: [{ id: "s", machines: { presse: { aVide: -5 } } }] }))).toHaveLength(1);
    expect(controlerFichier("reglages.json", JSON.stringify({ theme: "braise" }))[0]).toContain("format undefined");
    expect(controlerFichier(J, "{")[0]).toContain("JSON illisible");
  });
});
