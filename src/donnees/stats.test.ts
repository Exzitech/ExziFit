import { describe, expect, it } from "vitest";
import type { ExoFait, Seance, Serie } from "./journal";
import { membres, programme } from "./programme";
import { apercu, MUSCLES, progres, seuilConstance, stats, usure } from "./stats";

const t = (kg: number, reps: number, rir?: number): Serie => ({ type: "travail", kg, reps, rir });
const seance = (debut: string, ...exercices: ExoFait[]): Seance => ({ debut, exercices });
const MAINTENANT = new Date("2026-10-31T12:00:00+01:00");
const POIDS = [{ date: "2026-10-01", kg: 80 }];
const jour = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000).toISOString();

describe("usure", () => {
  it("rien pendant 21 jours, −1 % par semaine ensuite, plancher 0,7", () => {
    expect(usure(21)).toBe(1);
    expect(usure(28)).toBeCloseTo(0.99);
    expect(usure(5000)).toBe(0.7);
  });
});

describe("Force", () => {
  it("e1RM ÷ poids ÷ référence ; un single à 0 RIR n'apporte pas plus qu'un 5 à 1 RIR équivalent", () => {
    // 100 × 5 à 1 RIR = 120 ; 120 / 80 / 1,75 = 85,7.
    const s = [seance(jour(2), { exo: "developpe-couche", series: [t(100, 5, 1), t(120, 1, 0)] })];
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo(85.71, 1);
  });
  it("lesté : corps + lest ; moyenne des exos faits seulement", () => {
    const s = [seance(jour(2),
      { exo: "developpe-couche", series: [t(100, 5, 1)] },
      { exo: "tractions-lestees", series: [t(40, 5, 1)] })];
    // tractions : (80 + 40) × 1,2 = 144 ; 144 / 80 / 1,75 = 102,9.
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo((85.714 + 102.857) / 2, 1);
  });
  it("moyenne pondérée par le coefficient de l'exo", () => {
    const s = [seance(jour(2),
      { exo: "developpe-couche", series: [t(100, 5, 1)] },
      { exo: "rowing-barre", series: [t(80, 5, 1)] },
      { exo: "curl-marteau", series: [t(20, 8, 1)] })];
    // rowing : 96 / 80 / 1,5 = 80 (coef 0,5) ; curl : 20 × 1,3 = 26 / 80 / 0,35 = 92,86 (coef 0,25).
    const attendu = (85.714 * 1 + 80 * 0.5 + 92.857 * 0.25) / 1.75;
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo(attendu, 1);
  });
  it("ignore échauffements, RIR 4+, séries de plus de 10 reps et exos hors Force", () => {
    const s = [seance(jour(2),
      { exo: "developpe-couche", series: [{ type: "echauffement", kg: 200, reps: 5 }, t(200, 5, 4), t(150, 12, 0), t(100, 5, 1)] },
      { exo: "dips", series: [t(0, 8, 1)] },
      { exo: "rowing-barre", series: [t(200, 15, 1)] })];
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo(85.71, 1);
  });
  it("baisse après 3 semaines sans entraînement, remonte à la séance suivante", () => {
    const vieille = seance(jour(91), { exo: "developpe-couche", series: [t(100, 5, 1)] });
    expect(stats([vieille], POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo(85.71 * 0.99 ** 10, 1);
    const reprise = seance(jour(1), { exo: "developpe-couche", series: [t(100, 5, 1)] });
    expect(stats([vieille, reprise], POIDS, "homme", 2, MAINTENANT).force).toBeCloseTo(85.71, 1);
  });
  it("femme : référence × 0,65 en haut du corps, × 0,8 en bas", () => {
    const haut = [seance(jour(2), { exo: "developpe-couche", series: [t(100, 5, 1)] })];
    const bas = [seance(jour(2), { exo: "hack-squat", series: [t(100, 5, 1)] })];
    for (const [s, f] of [[haut, 0.65], [bas, 0.8]] as const) {
      expect(stats(s, POIDS, "femme", 2, MAINTENANT).force).toBeCloseTo(stats(s, POIDS, "homme", 2, MAINTENANT).force! / f, 6);
    }
  });
  it("non calculée sans pesée ou sans exo de Force", () => {
    const s = [seance(jour(2), { exo: "developpe-couche", series: [t(100, 5, 1)] })];
    expect(stats(s, [], "homme", 2, MAINTENANT).force).toBeUndefined();
    expect(stats([], POIDS, "homme", 2, MAINTENANT).force).toBeUndefined();
  });
});

describe("groupes et Endurance", () => {
  it("principal 1, secondaire 0,5, par semaine sur 28 jours, rien au-delà", () => {
    const s = [
      seance(jour(30), { exo: "developpe-couche", series: [t(100, 5, 1), t(100, 5, 1)] }),
      seance(jour(3), { exo: "developpe-couche", series: [t(100, 5, 1), t(100, 5, 1), t(100, 5, 1), t(100, 5, 5)] }),
    ];
    const g = stats(s, POIDS, "homme", 2, MAINTENANT).groupes;
    expect(g.pectoraux).toBeCloseTo(7.5); // 3 séries / 4 semaines × 10
    expect(g.triceps).toBeCloseTo(3.75);
    expect(g.dos).toBe(0);
  });
  it("plafond à 10 séries par semaine : le volume en plus ne compte pas", () => {
    const curls = { exo: "curl-marteau", series: Array.from({ length: 60 }, () => t(20, 10, 2)) };
    const st = stats([seance(jour(1), curls)], POIDS, "homme", 2, MAINTENANT);
    expect(st.groupes.biceps).toBe(100);
    expect(st.endurance).toBeCloseTo((100 + 75) / MUSCLES.length); // avant-bras en secondaire : 30 / 4 × 10
  });
});

describe("Constance", () => {
  it("seuil du Bloc Force : 5 jours non optionnels → 3 ; sans programme, 2", () => {
    expect(seuilConstance(programme("bloc-force"))).toBe(3);
    expect(seuilConstance(undefined)).toBe(2);
  });
  it("part des 8 tranches de 7 jours qui atteignent le seuil, sans série de jours", () => {
    const s = [1, 2, 3, 8, 9, 50, 51, 52, 60].map((j) => seance(jour(j)));
    // tranche 0 : 3 séances, tranche 1 : 2, tranche 7 (49–55 j) : 3, 60 j : hors fenêtre.
    expect(stats(s, POIDS, "homme", 3, MAINTENANT).constance).toBe(25);
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).constance).toBe(37.5);
  });
  it("débutant : compte sur les tranches écoulées depuis la 1re séance, au moins 4", () => {
    const deuxSemaines = [1, 2, 3, 8, 9, 10].map((j) => seance(jour(j)));
    expect(stats(deuxSemaines, POIDS, "homme", 3, MAINTENANT).constance).toBe(50); // 2 tenues / 4
    const sixSemaines = [1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24, 29, 30, 31, 36, 37, 38].map((j) => seance(jour(j)));
    expect(stats(sixSemaines, POIDS, "homme", 3, MAINTENANT).constance).toBe(100); // 6 / 6
    expect(stats([seance(jour(36))], POIDS, "homme", 1, MAINTENANT).constance).toBeCloseTo(100 / 6);
  });
  it("ignore les séances après la date de calcul", () => {
    expect(stats([seance(jour(-1)), seance(jour(-2))], POIDS, "homme", 2, MAINTENANT).constance).toBe(0);
  });
});

describe("Progression", () => {
  const dc = (debut: string, ...series: Serie[]) => seance(debut, { exo: "developpe-couche", series });
  it("1RM des 14 derniers jours contre 28 à 42 jours ; part des exos qui montent d'au moins 1 %", () => {
    const s = [
      dc(jour(35), t(100, 5, 1)), dc(jour(3), t(102.5, 5, 1)), // +2,5 % : monte
      seance(jour(35), { exo: "curl-marteau", series: [t(16, 10, 1)] }),
      seance(jour(3), { exo: "curl-marteau", series: [t(16, 10, 1), t(16, 10, 4)] }), // stagne, RIR 4 ignoré
    ];
    const p = progres(s, POIDS, MAINTENANT);
    expect(p.find((x) => x.exo === "developpe-couche")).toMatchObject({ actuel: 123, avant: 120 });
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).progression).toBe(50);
  });
  it("exo nouveau ou pas fait récemment : hors de la stat ; sans comparable, stat non calculée", () => {
    const s = [dc(jour(20), t(100, 5, 1)), dc(jour(3), t(100, 5, 1))]; // jour 20 : hors des deux fenêtres
    expect(progres(s, POIDS, MAINTENANT)).toEqual([{ exo: "developpe-couche", actuel: 120, avant: undefined }]);
    expect(stats(s, POIDS, "homme", 2, MAINTENANT).progression).toBeUndefined();
    expect(progres([dc(jour(35), t(100, 5, 1))], POIDS, MAINTENANT)).toEqual([]);
  });
  it("au poids du corps : corps compté, ignoré sans pesée ; distances ignorées", () => {
    const dips = (j: number, reps: number) => seance(jour(j), { exo: "dips", series: [t(0, reps, 1)] });
    const s = [dips(35, 8), dips(3, 10), seance(jour(3), { exo: "farmer-walk", series: [t(40, 30, 1)] })];
    // 80 × (1 + 9/30) = 104 → 80 × (1 + 11/30) = 109,3.
    expect(progres(s, POIDS, MAINTENANT)).toEqual([{ exo: "dips", actuel: expect.closeTo(109.33, 1), avant: 104 }]);
    expect(progres(s, [], MAINTENANT)).toEqual([]);
  });
});

describe("aperçu d'un programme", () => {
  it("donne les groupes et l'Endurance de 4 semaines réellement faites", () => {
    const p = programme("superset-express");
    // Chaque jour non optionnel une fois par semaine, postes obligatoires, séries à 2 RIR.
    const faites: Seance[] = [];
    for (let sem = 0; sem < 4; sem++) {
      p.jours.filter((j) => !j.optionnel).forEach((j, i) => faites.push(seance(jour(1 + sem * 7 + i),
        ...j.exercices.filter((x) => !x.optionnel).flatMap((x) => membres(x).map((exo) => ({
          exo, series: Array.from({ length: (x.prescription as { series: number }).series }, () => t(20, 10, 2)),
        }))))));
    }
    const vraies = stats(faites, POIDS, "homme", 2, MAINTENANT);
    const a = apercu(p);
    for (const m of MUSCLES) expect(a.groupes[m], m).toBeCloseTo(vraies.groupes[m]);
    expect(a.endurance).toBeCloseTo(vraies.endurance);
  });

  it("ne compte ni les jours ni les exos en option, et les séries lourdes sur les seuls exos de Force", () => {
    const force = apercu(programme("bloc-force"));
    expect(force.seances).toBe(5);
    expect(force.groupes.mollets).toBe(0); // mollets debout en option au J2
    expect(force.lourdes).toBeGreaterThan(0);
    expect(apercu(programme("superset-express")).lourdes).toBe(0); // rien sous 8 reps
  });
});
