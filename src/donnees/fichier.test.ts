import { describe, expect, it } from "vitest";
import { cheminJournal, horodatage, jourLocal, verifierFormat } from "./fichier";

describe("verifierFormat", () => {
  it("accepte le format courant", () => {
    expect(verifierFormat("r.json", { format: 1, theme: "nuit" })).toEqual({ format: 1, theme: "nuit" });
  });
  it("refuse sans numéro, plus récent ou inconnu", () => {
    expect(() => verifierFormat("r.json", { theme: "nuit" })).toThrow("absent");
    expect(() => verifierFormat("r.json", [])).toThrow("absent");
    expect(() => verifierFormat("r.json", null)).toThrow("absent");
    expect(() => verifierFormat("r.json", { format: 2 })).toThrow("plus récente");
    expect(() => verifierFormat("r.json", { format: "1" })).toThrow("inconnu");
  });
});

describe("dates locales", () => {
  // Constructeur à composantes : heure locale, quel que soit le fuseau de la machine de test.
  it("journal du mois, bornes comprises", () => {
    expect(cheminJournal(new Date(2026, 9, 1, 0, 0, 0))).toBe("journal/2026-10.json");
    expect(cheminJournal(new Date(2026, 9, 31, 23, 59, 59))).toBe("journal/2026-10.json");
    expect(cheminJournal(new Date(2027, 0, 1, 0, 30))).toBe("journal/2027-01.json");
  });
  it("jour et horodatage", () => {
    const d = new Date(2026, 9, 14, 18, 2, 11);
    expect(jourLocal(d)).toBe("2026-10-14");
    const h = horodatage(d);
    expect(h).toMatch(/^2026-10-14T18:02:11[+-]\d{2}:\d{2}$/);
    // Le fuseau écrit désigne bien le même instant.
    expect(new Date(h).getTime()).toBe(d.getTime());
  });
});
