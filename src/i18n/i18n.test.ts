import { afterEach, describe, expect, it } from "vitest";
import { SEUILS } from "../donnees/avatar";
import { EXERCICES, exercice } from "../donnees/exercices";
import { cible, encouragement, nombre, preparation, PROGRAMMES } from "../donnees/programme";
import { appliquerLangue } from "../langue";
import { en } from "./en";
import { fr } from "./fr";
import { langueDuSysteme, t } from "./index";
import { pt } from "./pt";

const AUTRES = { en, pt };
/** Programmes du code : lus avant tout changement de langue, donc en français. */
const DU_CODE = PROGRAMMES.filter((p) => !p.id.startsWith("perso-"));

/** Textes affichés d'un programme, ceux que `traduireProgrammes` remplace. */
const textes = (p: (typeof PROGRAMMES)[number]) => [
  p.nom,
  ...p.semaines.map((s) => s.label),
  ...p.jours.flatMap((j) => [j.nom, j.note, ...j.exercices.map((x) => x.note)]),
].filter((x): x is string => x !== undefined);

afterEach(() => appliquerLangue("fr"));

describe("dictionnaires", () => {
  for (const [nom, d] of Object.entries(AUTRES)) {
    it(`${nom} : chaque texte affiché des programmes du code est traduit`, () => {
      const manquants = DU_CODE.flatMap(textes).filter((x) => !(x in d.programmesTextes));
      expect(manquants).toEqual([]);
    });

    it(`${nom} : listes alignées sur le français`, () => {
      expect(d.calculs.mobilite).toHaveLength(fr.calculs.mobilite.length);
      for (const tr of Object.keys(SEUILS) as (keyof typeof SEUILS)[]) expect(d.effets[tr]).toHaveLength(SEUILS[tr].length);
      expect(Object.keys(d.exos).filter((id) => !EXERCICES.some((e) => e.id === id))).toEqual([]);
    });
  }

  it("le français a un effet par palier", () => {
    for (const tr of Object.keys(SEUILS) as (keyof typeof SEUILS)[]) expect(fr.effets[tr]).toHaveLength(SEUILS[tr].length);
  });

  it("portugais : un nom pour chaque exercice du catalogue", () => {
    expect(EXERCICES.map((e) => e.id).filter((id) => !(id in pt.exos))).toEqual([]);
  });
});

describe("appliquerLangue", () => {
  it("traduit noms d'exos et programmes sans toucher aux ids, et revient au français", () => {
    const ids = PROGRAMMES.map((p) => [p.id, p.jours.map((j) => j.id)]);
    appliquerLangue("pt-BR");
    expect(exercice("developpe-couche").nom).toBe("Supino reto");
    expect(PROGRAMMES.find((p) => p.id === "bloc-force")!.nom).toBe("Bloco de Força");
    expect(PROGRAMMES.find((p) => p.id === "bloc-force")!.jours[1].exercices[1].note).toBe("por perna");
    expect(PROGRAMMES.map((p) => [p.id, p.jours.map((j) => j.id)])).toEqual(ids);
    appliquerLangue("fr");
    expect(exercice("developpe-couche").nom).toBe("Bench press");
    expect(PROGRAMMES.find((p) => p.id === "bloc-force")!.jours[1].exercices[1].note).toBe("par jambe");
  });

  it("anglais : nombres à point, % collé, textes calculés traduits", () => {
    appliquerLangue("en");
    expect(nombre(127.5)).toBe("127.5");
    const bench = exercice("developpe-couche");
    const sem = PROGRAMMES.find((p) => p.id === "push-pull-legs")!.semaines[1];
    expect(sem.label).toBe("72.5%");
    expect(cible(bench, { type: "pct1rm", schema: "p" }, { semaine: sem, rm: 100, passees: [] }).texte).toBe("72.5%");
    expect(preparation([bench]).etapes[0]).toBe("Arm circles · 10 each way");
    expect(en.calculs.phrases).toContain(encouragement(bench, [], [], "x"));
    expect(t.idJour("J4")).toBe("D4");
  });
});

describe("langueDuSysteme", () => {
  it("français, portugais, sinon anglais", () => {
    const l = (x: string) => {
      Object.defineProperty(globalThis.navigator, "language", { value: x, configurable: true });
      return langueDuSysteme();
    };
    expect([l("fr-BE"), l("pt-PT"), l("pt-BR"), l("de-DE"), l("en-US")]).toEqual(["fr", "pt-BR", "pt-BR", "en", "en"]);
  });
});
