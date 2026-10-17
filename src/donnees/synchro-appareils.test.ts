import { beforeEach, describe, expect, it, vi } from "vitest";

// Deux appareils simulés (fichiers en mémoire) et un serveur WebDAV qui respecte l'ETag.
const appareils = { tel: new Map<string, string>(), pc: new Map<string, string>() };
let ici: keyof typeof appareils = "tel";
const serveur: { texte: string | null; version: number } = { texte: null, version: 0 };
const sauvegardes: string[] = [];

vi.mock("../stockage", () => ({
  dansTauri: false,
  stockage: {
    lire: async (c: string) => appareils[ici].get(c) ?? null,
    ecrire: async (c: string, t: string) => void appareils[ici].set(c, t),
    lister: async (d: string) =>
      [...appareils[ici].keys()].filter((k) => k.startsWith(d + "/")).map((k) => k.slice(d.length + 1)).sort(),
    supprimer: async (c: string) => void appareils[ici].delete(c),
    sauvegardeSynchro: async (i: string) => (sauvegardes.push(`${ici}:${i}`), i),
    synchroLire: async () =>
      serveur.texte === null ? { etat: "absent" } : { etat: "ok", texte: serveur.texte, etag: `"${serveur.version}"` },
    synchroEcrire: async (texte: string, etag: string | null) => {
      if (etag !== (serveur.texte === null ? null : `"${serveur.version}"`)) return { etat: "conflit" };
      serveur.texte = texte;
      serveur.version++;
      return { etat: "ok", etag: `"${serveur.version}"` };
    },
  },
}));

const { archiverSeance, corrigerSeance, lireSeances } = await import("./journal");
const { synchroniser } = await import("./synchro");
const { enregistrerProgramme, lireProgrammesPerso, versProgramme } = await import("./programmes-perso");
const { ecrireSalles, lireSalles } = await import("./salles");
const { ecrireReglages, lireReglages } = await import("./reglages");

const sur = async <T>(a: typeof ici, f: () => Promise<T>) => {
  ici = a;
  return f();
};
const seance = { debut: "2026-10-14T18:00:00+02:00", fin: "2026-10-14T19:00:00+02:00",
  exercices: [{ exo: "developpe-couche", series: [{ type: "travail" as const, kg: 100, reps: 5, rir: 2 }] }] };

describe("synchro entre deux appareils", () => {
  beforeEach(() => {
    appareils.tel.clear();
    appareils.pc.clear();
    serveur.texte = null;
    serveur.version = 0;
    sauvegardes.length = 0;
  });

  it("séance du téléphone → PC ; correction du PC → téléphone, ancienne version à la corbeille", async () => {
    await sur("tel", () => archiverSeance(seance));
    expect(await sur("tel", synchroniser)).toMatchObject({ etat: "ok", recues: false, envoyees: true });

    expect(await sur("pc", synchroniser)).toMatchObject({ etat: "ok", recues: true, envoyees: false });
    expect(await sur("pc", lireSeances)).toEqual([seance]);
    expect(sauvegardes).toEqual([expect.stringMatching(/^pc:/)]);

    await sur("pc", () => corrigerSeance(seance.debut, { ...seance, exercices: [{ ...seance.exercices[0], series: [{ ...seance.exercices[0].series[0], kg: 102.5 }] }] }));
    await sur("pc", synchroniser);
    expect(await sur("tel", synchroniser)).toMatchObject({ recues: true });
    expect((await sur("tel", lireSeances))[0].exercices[0].series[0].kg).toBe(102.5);
    const corbeille = JSON.parse(appareils.tel.get("corbeille.json") as string);
    expect(corbeille.seances.map((x: { seance: { exercices: { series: { kg: number }[] }[] } }) => x.seance.exercices[0].series[0].kg)).toEqual([100]);
  });

  it("suppression sur le PC : la séance disparaît aussi du téléphone", async () => {
    await sur("tel", () => archiverSeance(seance));
    await sur("tel", synchroniser);
    await sur("pc", synchroniser);
    await sur("pc", () => corrigerSeance(seance.debut, null));
    await sur("pc", synchroniser);
    await sur("tel", synchroniser);
    expect(await sur("tel", lireSeances)).toEqual([]);
    // Et elle ne revient pas : une synchro de plus ne change rien.
    expect(await sur("tel", synchroniser)).toMatchObject({ recues: false, envoyees: false });
  });

  it("séances faites des deux côtés hors ligne : toutes gardées", async () => {
    const autre = { ...seance, debut: "2026-10-13T12:00:00+02:00", fin: "2026-10-13T13:00:00+02:00" };
    await sur("tel", () => archiverSeance(seance));
    await sur("pc", () => archiverSeance(autre));
    await sur("tel", synchroniser);
    await sur("pc", synchroniser);
    await sur("tel", synchroniser);
    for (const a of ["tel", "pc"] as const) {
      expect((await sur(a, lireSeances)).map((s) => s.debut)).toEqual([autre.debut, seance.debut]);
    }
  });
});

describe("synchro des programmes, salles et profil", () => {
  const reglages = (a: typeof ici) => JSON.parse(appareils[a].get("reglages.json") as string);

  beforeEach(() => {
    appareils.tel.clear();
    appareils.pc.clear();
    serveur.texte = null;
    serveur.version = 0;
  });

  it("programme perso et réglage de machine du téléphone → PC", async () => {
    const p = versProgramme({ nom: "Haut / bas", jours: [{ nom: "Haut", objectif: "force", exos: [{ exo: "developpe-couche" }] }] }, "perso-test");
    await sur("tel", () => enregistrerProgramme(p));
    await sur("tel", () => ecrireSalles([{ id: "salle-1", nom: "Basic-Fit", machines: { "presse-cuisses": { aVide: 70 } } }]));
    await sur("tel", synchroniser);
    expect(await sur("pc", synchroniser)).toMatchObject({ recues: true });
    expect((await sur("pc", lireProgrammesPerso)).map((x) => x.nom)).toEqual(["Haut / bas"]);
    expect((await sur("pc", lireSalles))[0].machines).toEqual({ "presse-cuisses": { aVide: 70 } });
  });

  it("salle par défaut jamais écrite : n'écrase pas celle de l'autre appareil", async () => {
    await sur("tel", () => ecrireSalles([{ id: "salle-1", nom: "Basic-Fit", machines: {} }]));
    await sur("tel", synchroniser);
    await sur("pc", synchroniser);
    expect((await sur("pc", lireSalles))[0].nom).toBe("Basic-Fit");
    // Le PC ne renvoie rien : sa salle par défaut n'était qu'affichée.
    expect(await sur("pc", synchroniser)).toMatchObject({ recues: false, envoyees: false });
  });

  it("profil : la première écriture ne s'impose pas, un changement suit, le thème reste à chaque appareil", async () => {
    await sur("tel", () => ecrireReglages({ format: 1, theme: "braise", prenom: "Tom", programme: "bloc-force" }));
    await sur("pc", () => ecrireReglages({ format: 1, theme: "nuit", programme: "ppl" }));
    await sur("tel", synchroniser);
    await sur("pc", synchroniser);
    expect(reglages("pc")).toEqual({ format: 1, theme: "nuit", programme: "ppl" });

    const tel = (await sur("tel", lireReglages))!;
    await sur("tel", () => ecrireReglages({ ...tel, programme: "endurance" }));
    await sur("tel", synchroniser);
    expect(await sur("pc", synchroniser)).toMatchObject({ recues: true });
    expect(reglages("pc")).toMatchObject({ theme: "nuit", prenom: "Tom", programme: "endurance", profilModifie: expect.any(String) });
    // Un changement de thème garde la date du profil (l'écran n'a pas forcément la dernière).
    const avant = reglages("pc").profilModifie;
    await sur("pc", () => ecrireReglages({ format: 1, theme: "braise", prenom: "Tom", programme: "endurance" }));
    expect(reglages("pc").profilModifie).toBe(avant);
  });

  it("etat.json écrit avant 0.1.47 (sans programmes ni salles) : lu comme vide", async () => {
    serveur.texte = JSON.stringify({ format: 1, seances: [seance], suppressions: [], blocs: [], pesees: [] });
    // Complété à la lecture ; rien à renvoyer tant que rien ne change.
    expect(await sur("pc", synchroniser)).toMatchObject({ etat: "ok", recues: true, envoyees: false });
    expect((await sur("pc", lireSeances)).map((s) => s.debut)).toEqual([seance.debut]);
  });
});
