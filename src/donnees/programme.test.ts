import { describe, expect, it } from "vitest";
import { exercice } from "./exercices";
import type { Seance, Serie } from "./journal";
import {
  aRattraper, avertissements, bilan, blocFini, cible, disques, echauffement, encouragement, etatTest, preparation, exosPct1rm, membres, ouvertureTest, programme,
  programmeDe, PROGRAMMES, prochainJour, recalage, resultatTest, retour, rmEffectif, rmNouveauBloc, semaineDe, tropFacile, clePoste, poserRepos, reposDuCode,
} from "./programme";

const PROGRAMME = programme("bloc-force");
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
    // Régression (retour de Tom, presse à cuisses) : 200 kg à 4+ RIR partout, l'app restait à 200.
    it("dernière série à 4+ RIR pour 2 visés → la charge suit la réserve", () => {
      const presse = exercice("presse-cuisses");
      const pp = { type: "fourchette" as const, series: 4, repsMin: 10, repsMax: 15, rir: 2 };
      const c = cible(presse, pp, { semaine: S1, passees: [faite("2026-10-01", presse.id, [t(200, 10, 4), t(200, 10, 4)])] });
      // 200 × (1 + 14/30) = 293,3 ; 10 reps à 2 RIR → 293,3 / 1,4 = 209,5 → 210.
      expect(c).toMatchObject({ kg: 210, reps: 10 });
      // 3 RIR pour 2 visés : proche du but, la double progression continue.
      expect(cible(presse, pp, { semaine: S1, passees: [faite("2026-10-01", presse.id, [t(200, 10, 3)])] }))
        .toMatchObject({ kg: 200, reps: 11 });
    });
    it("charge montée en séance → base = la série la plus lourde dans la fourchette", () => {
      expect(avec([t(55, 9, 4), t(60, 9, 2), t(60, 8, 2)])).toMatchObject({ kg: 60, reps: 10 });
    });
    it("poids du corps : lestable → un cran de lest ; sans lest → le haut de fourchette reste visé", () => {
      const pp = { type: "fourchette" as const, series: 2, repsMin: 8, repsMax: 15, rir: 2 };
      const fait = (id: string, kg: number) => cible(exercice(id), pp, { semaine: S1, passees: [faite("2026-10-01", id, [t(kg, 15, 4), t(kg, 15, 4)])] });
      expect(fait("pompes", 0)).toMatchObject({ kg: 2.5, reps: 8 });
      expect(fait("pompes-piquees", 0)).toMatchObject({ kg: 0, reps: 15 });
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

describe("repos changés sur un programme fourni", () => {
  it("posés par poste (par ses exos), défaut gardé, retirés → ceux du programme", () => {
    const ppl = () => programme("push-pull-legs");
    const jour = ppl().jours.find((j) => j.exercices.some((x) => x.exo === "presse-cuisses"))!;
    const poste = () => ppl().jours.find((j) => j.id === jour.id)!.exercices.find((x) => x.exo === "presse-cuisses")!;
    const cle = clePoste("push-pull-legs", jour.id, poste());
    expect(cle).toBe(`push-pull-legs/${jour.id}/presse-cuisses`);
    try {
      poserRepos({ [cle]: 180 });
      expect(poste().repos).toBe(180);
      expect(reposDuCode("push-pull-legs", jour.id, poste())).toBe(120);
    } finally {
      poserRepos({});
    }
    expect(poste().repos).toBe(120);
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

it("échauffement : barre ×15, puis 40 / 60 / 75 % arrondis", () => {
  expect(echauffement(exercice("developpe-couche"), 127.5)).toEqual(["Barre ×15", "50 ×5", "77,5 ×3", "95 ×2"]);
  expect(echauffement(exercice("developpe-couche"), 40)).toEqual(["Barre ×15", "25 ×3", "30 ×2"]);
  expect(echauffement(exercice("tractions-lestees"), 17.5)).toEqual(["PDC ×5", "+10 ×3"]);
});

it("disques par côté", () => {
  expect(disques(127.5)).toEqual([25, 25, 2.5, 1.25]);
  expect(disques(100)).toEqual([25, 15]);
  expect(disques(20)).toEqual([]);
  expect(disques(21)).toBeNull();
  // Régression : 1RM de 99999999 → 1,6 million de disques affichés, app figée à chaque relance.
  expect(disques(1020)).toHaveLength(20);
  expect(disques(80_000_000)).toBeNull();
  expect(disques(1e9, 0)).toBeNull();
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

describe("fourchette trop facile en séance", () => {
  const presse = exercice("presse-cuisses");
  const pr = { type: "fourchette" as const, series: 4, repsMin: 10, repsMax: 15, rir: 2 };
  it("4+ pour 2 visés → recalée, au moins un pas ; moins de réserve → rien", () => {
    expect(tropFacile(presse, pr, t(200, 10, 4), 10)).toBe(210);
    expect(tropFacile(presse, pr, t(20, 10, 4), 10)).toBe(25);
    expect(tropFacile(presse, pr, t(200, 10, 3), 10)).toBeNull();
    expect(tropFacile(presse, pr, t(200, 10), 10)).toBeNull();
    expect(tropFacile(presse, pr, t(200, 8, 4), 10)).toBeNull();
  });
  it("sans RIR noté, 2 visés", () => {
    expect(tropFacile(presse, { ...pr, rir: undefined }, t(200, 10, 4), 10)).toBe(210);
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

  it("programme d'une seule semaine : jamais fini, la semaine se répète", () => {
    const p = programme("endurance");
    expect(blocFini(p, [jour("2026-11-10T18:00:00+02:00", "J4")], "b", 0)).toBe(false);
    expect(semaineDe(p, [jour("2026-11-10T18:00:00+02:00", "J4")], "b", 0)).toBe(0);
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

describe("encouragement de fin d'exo", () => {
  const bench = exercice("developpe-couche");
  const passees = [faite("2026-10-01", "developpe-couche", [t(130, 5, 1), t(130, 5, 0)])];

  it("record de 1RM estimé d'abord", () => {
    expect(encouragement(bench, [t(135, 5, 1)], passees, "x")).toMatch(/^Record : 1RM estimé 162 kg \(avant 156\)/);
  });

  it("charge ou reps au-dessus de la dernière fois, sans record", () => {
    expect(encouragement(bench, [t(132.5, 3, 0)], passees, "x")).toBe("+2,5 kg par rapport à la dernière fois.");
    expect(encouragement(bench, [t(130, 5, 0), t(130, 5, 0), t(130, 2, 0)], passees, "x")).toBe("2 reps de plus que la dernière fois.");
  });

  it("sinon une phrase sans chiffre, la même pour la même graine", () => {
    const a = encouragement(bench, [t(120, 5, 0)], passees, "seance-1");
    expect(a).not.toMatch(/\d/);
    expect(encouragement(bench, [t(120, 5, 0)], passees, "seance-1")).toBe(a);
    // Première fois : rien à comparer.
    expect(encouragement(bench, [t(100, 5, 1)], [], "y")).not.toMatch(/\d/);
  });
});

describe("échauffement général", () => {
  const jourDe = (id: string) => PROGRAMME.jours.find((j) => j.id === id)!.exercices.flatMap((p) => p.superset ?? [p.exo as string]).map(exercice);

  it("la mobilité des seuls muscles du jour, sans cardio", () => {
    const bench = preparation(jourDe("J1"));
    expect(bench.etapes.join()).not.toMatch(/Jumping/);
    expect(bench.etapes.join()).toMatch(/Pompes/);
    expect(bench.etapes.join()).not.toMatch(/Squat|pointes/);
    const jambes = preparation(jourDe("J2"));
    expect(jambes.etapes.join()).toMatch(/Squat au poids du corps.*Good morning.*pointes/);
    expect(jambes.etapes.join()).not.toMatch(/Pompes/);
  });

  it("3 min au plus, sans matériel, pour chaque jour de chaque programme", () => {
    for (const p of PROGRAMMES) for (const j of p.jours) {
      const prep = preparation(j.exercices.flatMap(membres).map(exercice));
      expect(prep.minutes, `${p.id} ${j.id}`).toBeLessThanOrEqual(3);
      expect(prep.etapes.join(), `${p.id} ${j.id}`).not.toMatch(/vélo|rameur|bâton|élastique|barre|band/i);
    }
  });
});

describe("programmes", () => {
  it("chaque programme ne cite que des exos connus et des schémas présents chaque semaine", () => {
    for (const p of PROGRAMMES) {
      expect(new Set(p.jours.map((j) => j.id)).size, p.id).toBe(p.jours.length);
      for (const j of p.jours) for (const x of j.exercices) {
        for (const id of [...(x.superset ?? [x.exo as string]), ...(x.alternatives ?? [])]) expect(() => exercice(id), `${p.id} ${j.id}`).not.toThrow();
        const pr = x.prescription;
        if (pr.type === "pct1rm") for (const s of p.semaines) expect(s.schemas[pr.schema], `${p.id} ${j.id} ${s.nom}`).toBeDefined();
      }
    }
  });

  it("séance sans programme noté = Bloc Force ; séance libre = aucun ; id inconnu = défaut", () => {
    expect(programmeDe({ debut: "", jour: "J1", exercices: [] })?.id).toBe("bloc-force");
    expect(programmeDe({ debut: "", jour: "J1", programme: "endurance", exercices: [] })?.id).toBe("endurance");
    expect(programmeDe({ debut: "", exercices: [] })).toBeUndefined();
    expect(programme("retire").id).toBe("bloc-force");
  });
});

describe("rattrapage", () => {
  const J = (id: string) => PROGRAMME.jours.find((j) => j.id === id)!;
  /** Séance du bloc « b » : un exo par entrée, une série de travail chacun. */
  const fait = (debut: string, j: string, exos: string[], extra: Partial<Seance> = {}): Seance =>
    ({ debut, fin: debut, bloc: "b", jour: j, exercices: exos.map((exo) => ({ exo, series: [t(50, 8, 2)] })), ...extra });
  const ids = (r: ReturnType<typeof aRattraper>) => r.map((x) => `${x.r.jour}:${x.r.poste}`);

  it("propose les postes sans aucune série, pas les optionnels ni ceux du jour prévu", () => {
    // J4 fini sans leg curl ni crunch ; le J6 prévu ne contient aucun des deux.
    const s = [fait("2026-10-14T18:00:00", "J4", ["souleve-de-terre", "hip-thrust"])];
    const r = aRattraper(PROGRAMME, s, "b", J("J6"), new Date("2026-10-17T18:00:00"));
    expect(ids(r)).toEqual(["J4:2", "J4:3"]);
    expect(r.every((x) => x.bloque === null)).toBe(true);
    // J1 sans l'incliné (optionnel) : rien à rattraper.
    expect(aRattraper(PROGRAMME, [fait("2026-10-14T18:00:00", "J1", ["developpe-couche", "dips-lestes", "extension-triceps-poulie-haute"])], "b", J("J2"), new Date("2026-10-15T18:00:00"))).toEqual([]);
  });

  it("deadlift sauté, squat la veille : gardé pour plus tard, avec la raison", () => {
    const s = [
      fait("2026-10-12T18:00:00", "J4", ["hip-thrust", "leg-curl-assis", "crunch-poulie-haute"]),
      { debut: "2026-10-14T18:00:00", exercices: [{ exo: "squat", series: [t(100, 5, 2)] }] }, // séance libre
    ];
    const r = aRattraper(PROGRAMME, s, "b", J("J6"), new Date("2026-10-15T18:00:00"));
    expect(r).toHaveLength(1);
    expect(r[0].bloque).toBe("Back squat il y a 24 h : 48 h conseillées avant Deadlift.");
    expect(aRattraper(PROGRAMME, s, "b", J("J6"), new Date("2026-10-16T19:00:00"))[0].bloque).toBeNull();
  });

  it("règle du programme : pas de deadlift le jour du hack squat", () => {
    const s = [fait("2026-10-12T18:00:00", "J4", ["hip-thrust"])];
    const r = aRattraper(PROGRAMME, s, "b", J("J2"), new Date("2026-10-15T18:00:00"));
    expect(r.find((x) => x.r.poste === 0)?.bloque).toBe("Hack squat au programme du jour : 48 h conseillées avec Deadlift.");
  });

  it("refait depuis (rattrapage ou remplaçant), trop ancien, autre bloc : plus proposé", () => {
    const sautee = fait("2026-10-12T18:00:00", "J4", ["souleve-de-terre", "hip-thrust", "leg-curl-assis"]);
    const maintenant = new Date("2026-10-15T18:00:00");
    expect(ids(aRattraper(PROGRAMME, [sautee], "b", J("J6"), maintenant))).toEqual(["J4:3"]);
    const refait = fait("2026-10-13T18:00:00", "J5", [], {
      bloc: undefined, jour: undefined,
      exercices: [{ exo: "crunch-poulie-haute", series: [] }, { exo: "releve-jambes", remplace: "crunch-poulie-haute", series: [t(0, 12, 2)] }],
    });
    expect(aRattraper(PROGRAMME, [sautee, refait], "b", J("J6"), maintenant)).toEqual([]);
    expect(aRattraper(PROGRAMME, [sautee], "b", J("J6"), new Date("2026-10-21T18:00:00"))).toEqual([]);
    expect(aRattraper(PROGRAMME, [sautee], "autre", J("J6"), maintenant)).toEqual([]);
  });
});
