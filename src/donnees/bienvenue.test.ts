import { describe, expect, it } from "vitest";
import { BUTS, programmePropose, SEANCES_SEMAINE } from "./bienvenue";
import { PROGRAMMES } from "./programme";

describe("programmePropose", () => {
  it("muscle : PPL à 5 séances et plus, haut / bas en dessous", () => {
    expect(programmePropose("muscle", 6)).toBe("push-pull-legs");
    expect(programmePropose("muscle", 4)).toBe("superset-express");
  });
  it("chaque proposition est un programme du code", () => {
    for (const b of BUTS) for (const n of SEANCES_SEMAINE) {
      expect(PROGRAMMES.some((p) => p.id === programmePropose(b, n))).toBe(true);
    }
  });
});
