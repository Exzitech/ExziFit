import { describe, expect, it } from "vitest";
import { chargeDouteuse, poidsCorpsDouteux, repsDouteuses } from "./aberrant";

describe("valeurs à confirmer", () => {
  it("charge : faute de frappe d'un zéro en trop, pas une vraie progression", () => {
    expect(chargeDouteuse(1050, 105)).toBe(true);
    expect(chargeDouteuse(150, 105)).toBe(false);
    expect(chargeDouteuse(210, 105)).toBe(false); // double pile : encore plausible (changement d'exo, de machine)
    expect(chargeDouteuse(28, 8)).toBe(false); // petite charge : +20 kg de marge
    expect(chargeDouteuse(30, 8)).toBe(true);
  });
  it("charge sans référence : seulement l'énorme", () => {
    expect(chargeDouteuse(300)).toBe(false);
    expect(chargeDouteuse(301)).toBe(true);
  });
  it("une grosse charge déjà faite ne redemande plus", () => {
    expect(chargeDouteuse(450, 440)).toBe(false);
  });
  it("reps", () => {
    expect(repsDouteuses(50)).toBe(false);
    expect(repsDouteuses(55)).toBe(true);
    expect(repsDouteuses(55, 40)).toBe(false);
    expect(repsDouteuses(120, 40)).toBe(true);
  });
  it("poids de corps", () => {
    expect(poidsCorpsDouteux(82)).toBe(false);
    expect(poidsCorpsDouteux(820)).toBe(true);
    expect(poidsCorpsDouteux(8.2)).toBe(true);
    expect(poidsCorpsDouteux(92, 82)).toBe(false);
    expect(poidsCorpsDouteux(28 + 72, 82)).toBe(true);
    expect(poidsCorpsDouteux(83, 820)).toBe(false); // correction d'une faute confirmée
  });
});
