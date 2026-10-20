import { describe, expect, it } from "vitest";
import type { Seance } from "./journal";
import { poserProgrammesPerso, programme, prochainJour, PROGRAMMES } from "./programme";
import { brouillonComplet, versBrouillon, versProgramme, type Brouillon } from "./programmes-perso";
import { apercu } from "./stats";

const B: Brouillon = {
  nom: " Haut / bas ",
  jours: [
    { nom: "Haut", objectif: "force", exos: [{ exo: "developpe-couche" }, { exo: "rowing-haltere", series: 4 }] },
    { nom: "", objectif: "endurance", exos: [{ exo: "presse-cuisses" }] },
  ],
};

describe("versProgramme", () => {
  it("objectif → fourchette, repos, principal en tête ; une semaine continue, sans règle", () => {
    const p = versProgramme(B, "perso-x");
    expect(p).toMatchObject({ id: "perso-x", nom: "Haut / bas", regles: [], semaines: [{ nom: "S1" }] });
    expect(p.jours.map((j) => [j.id, j.nom, j.lourd])).toEqual([["J1", "Haut", true], ["J2", "Jour 2", false]]);
    expect(p.jours[0].exercices).toEqual([
      { exo: "developpe-couche", role: "principal", prescription: { type: "fourchette", series: 4, repsMin: 4, repsMax: 6, rir: 2 }, repos: 180 },
      { exo: "rowing-haltere", prescription: { type: "fourchette", series: 4, repsMin: 8, repsMax: 10, rir: 2 }, repos: 120 },
    ]);
  });

  it("un jour modifié garde son id ; un jour ajouté après le retrait du dernier ne reprend pas son id", () => {
    const b = versBrouillon(versProgramme(B, "perso-x"));
    const bras = { nom: "Bras", objectif: "hypertrophie" as const, exos: [{ exo: "curl-marteau" }] };
    const p = versProgramme({ ...b, jours: [b.jours[0], bras] }, "perso-x"); // J2 retiré
    expect(p.jours.map((j) => j.id)).toEqual(["J1", "J3"]);
  });

  it("exo inconnu : erreur plutôt qu'un programme inutilisable", () => {
    expect(() => versProgramme({ nom: "x", jours: [{ nom: "", objectif: "force", exos: [{ exo: "nope" }] }] }, "perso-x")).toThrow("nope");
  });
});

describe("versBrouillon", () => {
  it("aller-retour identique ; les séries égales à l'objectif ne sont pas figées", () => {
    const p = versProgramme(B, "perso-x");
    const b = versBrouillon(p);
    expect(b.jours[0].exos).toEqual([{ exo: "developpe-couche" }, { exo: "rowing-haltere", series: 4 }]);
    expect(versProgramme(b, "perso-x")).toEqual(p);
  });
  it("repos changé gardé à l'aller-retour ; revenu à celui de l'objectif, plus noté", () => {
    const b: Brouillon = { nom: "x", jours: [{ nom: "", objectif: "force", exos: [{ exo: "developpe-couche", repos: 240 }, { exo: "rowing-haltere", repos: 120 }] }] };
    const p = versProgramme(b, "perso-x");
    expect(p.jours[0].exercices.map((x) => x.repos)).toEqual([240, 120]);
    expect(versBrouillon(p).jours[0].exos).toEqual([{ exo: "developpe-couche", repos: 240 }, { exo: "rowing-haltere" }]);
  });
});

describe("brouillonComplet", () => {
  it("nom et un exo par jour", () => {
    expect(brouillonComplet(B)).toBe(true);
    expect(brouillonComplet({ ...B, nom: "  " })).toBe(false);
    expect(brouillonComplet({ ...B, jours: [...B.jours, { nom: "", objectif: "force", exos: [] }] })).toBe(false);
  });
});

describe("programme écrit dans l'app", () => {
  it("trouvé par son id, tourne dans la rotation, a un aperçu ; les programmes du code restent", () => {
    const avant = PROGRAMMES.length;
    const p = versProgramme(B, "perso-x");
    poserProgrammesPerso([p]);
    try {
      expect(programme("perso-x")).toBe(p);
      const faite: Seance = { debut: "2026-10-01T10:00:00", bloc: "b", programme: "perso-x", semaine: 0, jour: "J1", exercices: [] };
      expect(prochainJour(p, [faite], "b", new Date("2026-10-02T10:00:00"))).toBe(1);
      expect(apercu(p).seances).toBe(2);
      expect(apercu(p).lourdes).toBe(4); // développé couché 4 × 4–6
      poserProgrammesPerso([]);
      expect(PROGRAMMES.length).toBe(avant);
    } finally {
      poserProgrammesPerso([]);
    }
  });
});
