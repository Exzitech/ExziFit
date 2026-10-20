import { describe, expect, it } from "vitest";
import sources from "../illustrations/sources.json";
import { EXERCICES } from "./exercices";
import { illustration } from "./illustrations";

describe("illustrations", () => {
  it("chaque exo listé existe au catalogue et a ses deux images générées", () => {
    const ids = new Set(EXERCICES.map((e) => e.id));
    for (const id of Object.keys(sources)) {
      expect(ids.has(id), id).toBe(true);
      expect(illustration(id), id).toBeDefined();
    }
  });

  it("un exo sans image (exo perso) n'a pas d'illustration", () => {
    expect(illustration("perso-123")).toBeUndefined();
  });
});
