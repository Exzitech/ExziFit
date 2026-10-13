import { describe, expect, it } from "vitest";
import { exercice } from "./exercices";
import type { Seance, Serie } from "./journal";
import {
  avertissements, bilan, blocFini, cible, disques, echauffement, etatTest, exosPct1rm, ouvertureTest, PROGRAMME,
  prochainJour, recalage, resultatTest, retour, rmEffectif, rmNouveauBloc, semaineDe,
} from "./programme";

const S1 = PROGRAMME.semaines[0];
const S3 = PROGRAMME.semaines[2];
const S4 = PROGRAMME.semaines[3];
const t = (kg: number, reps: number, rir?: number): Serie => ({ type: "travail", kg, reps, rir });
const faite = (debut: string, exo: string, series: Serie[]): Seance => ({ debut, exercices: [{ exo, series }] });
const jour = (debut: string, j: string, semaine = 0): Seance => ({ debut, bloc: "b", semaine, jour: j, exercices: [] });

describe("cible", () => {
  it("% du 1RM figé, arrondi au pas, bas de la fourchette de %", () => {
    const pr = { type: "pct1rm" as const, schema: "std" };
    expect(cible(exercice("developpe-couche"), pr, { semaine: S1, rm: 160, passees: [] }))
      .toEqual({ series: 5, reps: 5, kg: 127.5, texte: "80 %" });
    expect(cible(exercice("developpe-couche"), pr, { semaine: S3, rm: 160, passees: [] }))
      .toMatchObject({ reps: 3, kg: 140, texte: "88–90 %" });
  });

  it("lesté : lest = % × total − poids de corps, inconnu sans pesée", () => {
    const pr = { type: "pct1rm" as const, schema: "std" };
    const e = exercice("tractions-lestees");
    expect(cible(e, pr, { semaine: S1, rm: 135, poidsCorps: 90, passees: [] }).kg).toBe(17.5);
    expect(cible(e, pr, { semaine: S1, rm: 135, passees: [] }).kg).toBeNull();
    expect(cible(e, pr, { semaine: S1, rm: 100, poidsCorps: 90, passees: [] }).kg).toBe(0);
  });

  it("sans 1RM : pas de charge (calibration)", () => {
    expect(cible(exercice("hack-squat"), { type: "pct1rm", schema: "std" }, { semaine: S1, passees: [] }).kg).toBeNull();
  });

  describe("double progression", () => {
    const pr = { type: "fourchette" as const, series: 3, repsMin: 8, repsMax: 10, rir: 2 };
    const e = exercice("rowing-barre");
    const avec = (series: Serie[]) => cible(e, pr, { semaine: S1, passees: [faite("2026-10-01", e.id, series)] });

    it("haut de fourchette partout avec la réserve → un pas de plus, bas de fourchette", () => {
      expect(avec([t(60, 10, 2), t(60, 10, 2), t(60, 10, 3)])).toMatchObject({ kg: 62.5, reps: 8 });
    });
    it("une série sous le haut, ou réserve non tenue → même charge, une rep de plus", () => {
      expect(avec([t(60, 8, 2), t(60, 8, 2), t(60, 7, 2)])).toMatchObject({ kg: 60, reps: 9 });
      expect(avec([t(60, 10, 1), t(60, 10, 2), t(60, 10, 2)])).toMatchObject({ kg: 60, reps: 10 });
    });
    it("jamais fait → pas de charge, bas de fourchette", () => {
      expect(cible(e, pr, { semaine: S1, passees: [] })).toMatchObject({ kg: null, reps: 8, texte: "8–10 reps" });
    });
  });

  it("RPE : charge tirée du 1RM estimé de la dernière fois", () => {
    const e = exercice("developpe-militaire-barre");
    // 60 × 5 à 2 RIR → e1RM 74 ; RPE 8 sur 5 reps = 7 « reps » → 74 / 1,2333 = 60.
    const c = cible(e, { type: "rpe", series: 4, reps: 5, rpe: 8 }, { semaine: S1, passees: [faite("2026-10-01", e.id, [t(60, 5, 2)])] });
    expect(c).toMatchObject({ series: 4, reps: 5, kg: 60, texte: "RPE 8" });
  });
});

describe("rotation", () => {
  const maintenant = new Date("2026-10-20T18:00:00");

  it("jour suivant la dernière séance du bloc, J1 au départ", () => {
    expect(prochainJour(PROGRAMME, [], "b", maintenant)).toBe(0);
    expect(prochainJour(PROGRAMME, [jour("2026-10-14T18:00:00+02:00", "J2")], "b", maintenant)).toBe(2);
  });

  it("J6 optionnel sauté après 5 jours lourds d'affilée, proposé après un jour de repos", () => {
    const cinq = ["J1", "J2", "J3", "J4", "J5"].map((j, i) => jour(`2026-10-${15 + i}T18:00:00+02:00`, j));
    expect(prochainJour(PROGRAMME, cinq, "b", maintenant)).toBe(0);
    expect(prochainJour(PROGRAMME, cinq, "b", new Date("2026-10-21T18:00:00"))).toBe(5);
  });

  it("semaine : +1 quand la rotation repart du début", () => {
    const s = [jour("2026-10-14T18:00:00+02:00", "J5", 0)];
    expect(semaineDe(PROGRAMME, s, "b", 5)).toBe(0);
    expect(semaineDe(PROGRAMME, s, "b", 0)).toBe(1);
    expect(semaineDe(PROGRAMME, [jour("2026-10-14T18:00:00+02:00", "J6", 3)], "b", 0)).toBe(3);
  });
});

it("exos dont le 1RM se saisit : les mouvements principaux", () => {
  expect(exosPct1rm(PROGRAMME)).toEqual(["developpe-couche", "hack-squat", "tractions-lestees", "souleve-de-terre"]);
});

it("échauffement : barre, puis 40 / 60 / 75 % arrondis", () => {
  expect(echauffement(exercice("developpe-couche"), 127.5)).toEqual(["Barre ×10", "50 ×5", "77,5 ×3", "95 ×2"]);
  expect(echauffement(exercice("developpe-couche"), 40)).toEqual(["Barre ×10", "25 ×3", "30 ×2"]);
  expect(echauffement(exercice("tractions-lestees"), 17.5)).toEqual(["PDC ×5", "+10 ×3"]);
});

it("disques par côté", () => {
  expect(disques(127.5)).toEqual([25, 25, 2.5, 1.25]);
  expect(disques(100)).toEqual([25, 15]);
  expect(disques(20)).toEqual([]);
  expect(disques(21)).toBeNull();
});

describe("retour", () => {
  it("−10 % arrondi au pas, jamais sous la barre", () => {
    expect(retour(exercice("developpe-couche"), 127.5)).toBe(115);
    expect(retour(exercice("hack-squat"), 140)).toBe(125);
    expect(retour(exercice("developpe-couche"), 20)).toBe(20);
  });

  it("lesté : −10 % du total corps + lest, lest seul sans pesée", () => {
    const e = exercice("tractions-lestees");
    expect(retour(e, 20, 90)).toBe(10);
    expect(retour(e, 5, 90)).toBe(0);
    expect(retour(e, 20)).toBe(17.5);
  });
});

describe("recalage en séance", () => {
  const bench = exercice("developpe-couche");

  it("140 × 5 fini à 2 RIR, visé 1 RIR → on monte ; à 1 RIR → même charge", () => {
    // 140 × (1 + 7/30) = 172,7 ; 5 reps à 1 RIR = 6 → 172,7 / 1,2 = 143,9 → 145.
    expect(recalage(bench, t(140, 5, 2), 5, 1, undefined, false)).toBe(145);
    expect(recalage(bench, t(140, 5, 1), 5, 1, undefined, false)).toBe(140);
  });

  it("série ratée (3 reps sur 5, 0 RIR) → on baisse d'environ 10 %", () => {
    expect(recalage(bench, t(140, 3, 0), 5, 1, undefined, false)).toBe(127.5);
  });

  it("sans RIR noté → pas de recalage", () => {
    expect(recalage(bench, t(140, 5), 5, 1, undefined, false)).toBeNull();
  });

  it("montée guidée : un palier à 4+ monte de 20 % (au moins 8 pas), le lesté de 10 % du total", () => {
    expect(recalage(bench, t(20, 5, 4), 5, 1, undefined, true)).toBe(40);
    expect(recalage(bench, t(120, 5, 4), 5, 1, undefined, true)).toBe(145);
    // Hors calibrage, 4+ n'est qu'un minimum : Epley seul (100 × 1,3 / 1,2 = 108,3).
    expect(recalage(bench, t(100, 5, 4), 5, 1, undefined, false)).toBe(107.5);
    const tractions = exercice("tractions-lestees");
    expect(recalage(tractions, t(0, 5, 4), 5, 1, 80, true)).toBe(7.5);
    expect(recalage(tractions, t(0, 5, 4), 5, 1, undefined, true)).toBeNull();
  });
});

describe("1RM effectif", () => {
  const bench = exercice("developpe-couche");
  const dans = (debut: string, bloc: string, series: Serie[]): Seance => ({ ...faite(debut, bench.id, series), bloc });

  it("relevé par la dernière séance du bloc, jamais baissé", () => {
    const mieux = [dans("2026-10-14", "b", [t(140, 5, 2)])];
    expect(rmEffectif(bench, mieux, "b", 160, undefined)).toBeCloseTo(172.67, 1);
    const moins = [...mieux, dans("2026-10-16", "b", [t(120, 5, 0)])];
    expect(rmEffectif(bench, moins, "b", 160, undefined)).toBe(160);
    // Une séance d'un autre bloc ne relève pas celui-ci.
    expect(rmEffectif(bench, [dans("2026-10-14", "a", [t(140, 5, 2)])], "b", 160, undefined)).toBe(160);
  });

  it("sans 1RM du bloc : estimé de la dernière fois, sinon inconnu (calibrage)", () => {
    expect(rmEffectif(bench, [dans("2026-09-01", "a", [t(120, 5, 1), t(120, 4, 0)])], "b", undefined)).toBeCloseTo(144, 1);
    expect(rmEffectif(bench, [], "b", undefined)).toBeUndefined();
    // Single à 0 RIR : sa charge, pas Epley (157,5 et non 162,75).
    expect(rmEffectif(bench, [dans("2026-09-01", "a", [t(157.5, 1, 0)])], "b", undefined)).toBe(157.5);
  });
});

describe("règles du bloc", () => {
  const J4 = PROGRAMME.jours[3];
  const hack = (debut: string, fin?: string): Seance => ({ ...faite(debut, "hack-squat", [t(140, 5, 2)]), fin });

  it("soulevé moins de 48 h après le hack squat → avertissement, compté depuis la fin de séance", () => {
    expect(avertissements(PROGRAMME, J4, [hack("2026-10-14T17:00:00+02:00", "2026-10-14T18:00:00+02:00")], new Date("2026-10-16T00:00:00+02:00")))
      .toEqual(["Hack squat il y a 30 h : 48 h conseillées avant Deadlift."]);
  });
  it("48 h passées, ou jour sans exo de la règle → rien", () => {
    expect(avertissements(PROGRAMME, J4, [hack("2026-10-14T18:00:00+02:00")], new Date("2026-10-16T18:00:00+02:00"))).toEqual([]);
    expect(avertissements(PROGRAMME, PROGRAMME.jours[0], [hack("2026-10-14T18:00:00+02:00")], new Date("2026-10-15T08:00:00+02:00"))).toEqual([]);
  });
});

describe("fin de bloc et test", () => {
  const bench = exercice("developpe-couche");
  const test = (kg: number, reps: number, rir?: number): Serie => ({ ...t(kg, reps, rir), test: true });

  it("bloc fini quand la dernière semaine a fait le tour", () => {
    expect(blocFini(PROGRAMME, [jour("2026-11-10T18:00:00+02:00", "J5", 3)], "b", 0)).toBe(true);
    expect(blocFini(PROGRAMME, [jour("2026-11-10T18:00:00+02:00", "J5", 3)], "b", 5)).toBe(false);
    expect(blocFini(PROGRAMME, [jour("2026-11-10T18:00:00+02:00", "J5", 2)], "b", 0)).toBe(false);
  });

  it("test : 1RM au bench, 3RM ailleurs, une fois par bloc, fini à 0 RIR ou sous les reps", () => {
    const vide: Seance = { debut: "", exercices: [] };
    expect(etatTest(S1, [], "b", vide, bench.id)).toBeNull();
    expect(etatTest(S4, [], "b", vide, bench.id)).toEqual({ reps: 1, fini: false });
    expect(etatTest(S4, [], "b", vide, "hack-squat")).toEqual({ reps: 3, fini: false });
    const avec = (series: Serie[]): Seance => faite("", bench.id, series);
    expect(etatTest(S4, [], "b", avec([test(150, 1, 1)]), bench.id)).toEqual({ reps: 1, fini: false });
    expect(etatTest(S4, [], "b", avec([test(150, 1, 1), test(155, 1, 0)]), bench.id)?.fini).toBe(true);
    expect(etatTest(S4, [], "b", avec([test(160, 0)]), bench.id)?.fini).toBe(true);
    // Déjà testé au J1 : pas de test au J5.
    expect(etatTest(S4, [{ ...avec([test(155, 1, 0)]), bloc: "b" }], "b", vide, bench.id)).toBeNull();
  });

  it("ouverture à 95 % du max estimé, résultat : single à 0 RIR = la charge, Epley sinon", () => {
    expect(ouvertureTest(bench, 160, 1)).toBe(152.5);
    expect(ouvertureTest(bench, 160, 3)).toBe(137.5);
    expect(resultatTest(bench, [t(140, 5, 2), test(150, 1, 1), test(155, 1, 0), test(160, 0, 0)])).toBe(155);
    expect(resultatTest(bench, [test(150, 1, 1)])).toBe(160);
    expect(resultatTest(exercice("hack-squat"), [test(150, 3, 0)])).toBe(165);
    expect(resultatTest(bench, [t(140, 5, 2)])).toBeUndefined();
  });

  it("1RM du bloc suivant : test du bloc, sinon 1RM effectif, au demi-kilo", () => {
    const s = (series: Serie[]): Seance => ({ ...faite("2026-11-10", bench.id, series), bloc: "b" });
    expect(rmNouveauBloc(bench, [s([test(152.5, 1, 1)])], "b", 160)).toBe(162.5);
    expect(rmNouveauBloc(bench, [s([t(140, 5, 2)])], "b", 160)).toBe(172.5);
    expect(rmNouveauBloc(bench, [], "b", undefined)).toBeUndefined();
  });
});

describe("bilan de séance", () => {
  it("durée, séries et tonnage de travail, record de 1RM estimé battu", () => {
    const passees = [faite("2026-10-01", "developpe-couche", [t(130, 5, 1)])];
    const s: Seance = {
      debut: "2026-10-14T18:00:00+02:00", fin: "2026-10-14T19:05:00+02:00",
      exercices: [
        { exo: "developpe-couche", series: [{ ...t(60, 5), type: "echauffement" }, t(140, 5, 1), t(140, 4, 0)] },
        { exo: "tractions-lestees", series: [t(10, 5, 2)] },
        { exo: "farmer-walk", series: [t(32, 30)] },
      ],
    };
    const b = bilan(s, passees, 80);
    expect(b).toMatchObject({ minutes: 65, series: 4, volume: 140 * 9 + 90 * 5 });
    expect(b.exos[0].record?.avant).toBeCloseTo(156, 0);
    expect(b.exos[0].record?.apres).toBeCloseTo(168, 0);
    // Jamais fait avant : pas de record.
    expect(b.exos[1].record).toBeUndefined();
    // Test : 157,5 × 1 à 0 RIR mesuré sous les 159 estimés avant → pas de record, malgré l'estimé à 1 RIR.
    const teste = { ...s, exercices: [{ exo: "developpe-couche", series: [{ ...t(152.5, 1, 1), test: true as const }, { ...t(157.5, 1, 0), test: true as const }] }] };
    expect(bilan(teste, [faite("2026-10-01", "developpe-couche", [t(140, 3, 1)])]).exos[0].record).toBeUndefined();
  });
});
