import { describe, expect, it } from "vitest";
import { EXERCICES, remplacants } from "./exercices";

describe("remplacants", () => {
  it("bulgarian sans banc : d'abord les fentes, puis les squats, jamais un développé avant", () => {
    const l = remplacants("fentes-bulgares");
    const ids = l.map((x) => x.e.id);
    expect(l[0].raison).toBe("mouvement");
    expect(new Set(ids.slice(0, 2))).toEqual(new Set(["split-squat", "fentes-marchees"]));
    expect(ids.indexOf("squat")).toBeLessThan(ids.indexOf("developpe-couche"));
    expect(l.find((x) => x.e.id === "developpe-couche")?.raison).toBeNull();
  });

  it("les alternatives du programme passent devant", () => {
    const l = remplacants("leg-curl-assis", ["leg-curl-allonge"]);
    expect(l[0]).toMatchObject({ e: { id: "leg-curl-allonge" }, raison: "programme" });
  });

  it("propose tous les autres exos, sans l'exo remplacé", () => {
    const l = remplacants("hack-squat");
    expect(l).toHaveLength(EXERCICES.length - 1);
    expect(l.some((x) => x.e.id === "hack-squat")).toBe(false);
  });

  it("chaque exo a un remplaçant de même schéma ou de mêmes muscles (sauf le farmer's walk, seul de son genre)", () => {
    for (const e of EXERCICES.filter((x) => x.id !== "farmer-walk")) expect(remplacants(e.id)[0].raison, e.id).not.toBeNull();
  });
});
