/**
 * Textes de l'interface en français : la référence. Les autres langues ont le même type (`Textes`),
 * le compilateur signale donc toute clé manquante. Textes à nombre = fonctions (pluriels, ordre des mots).
 */
const s = (n: number) => (n > 1 ? "s" : "");

export const fr = {
  locale: "fr-FR",
  /** « 80 % » ; `v` déjà formaté. */
  pct: (v: string) => `${v} %`,
  /** Identifiants stockés (`J1`, `S1`) tels qu'affichés. */
  idJour: (id: string) => id,
  idSemaine: (nom: string) => nom,

  commun: {
    homme: "Homme", femme: "Femme", prenom: "Prénom", poidsCorpsKg: "Poids de corps (kg)", poidsCorps: "Poids de corps",
    personnage: "Personnage", programme: "Programme", langue: "Langue", annuler: "Annuler", enregistrer: "Enregistrer",
    jours: (n: number) => `${n} jour${s(n)}`, semaines: (n: number) => `${n} semaine${s(n)}`, sem: (n: number) => `${n} sem.`,
    modifier: (nom: string) => `Modifier ${nom} ›`, groupes: "Groupes musculaires", option: "option",
  },
  app: {
    erreur: (contexte: string, message: string) => `${contexte} : ${message}`,
    recues: "Données reçues de l'autre appareil · Actualiser",
    ctx: {
      boutonRetour: "Bouton retour", synchro: "Synchro", programmesPerso: "Programmes perso", reglages: "Réglages",
      sauvegarde: "Sauvegarde du jour", envoi: "Envoi de la sauvegarde", enregistrement: "Enregistrement des réglages",
      bienvenue: "Bienvenue", seance: "Séance", journal: "Journal", personnage: "Personnage",
    },
  },
  nav: { seance: "Séance", journal: "Journal", perso: "Perso", reglages: "Réglages" },
  bienvenue: {
    creer: "+ Créer mon programme",
    choisir: "Choisis un programme pour voir ce qu'il fait monter.",
    ensuite: "Tout se change ensuite : programme sur l'accueil, le reste dans les réglages.",
    commencer: "Commencer",
    donnees: "Tes données restent sur ce téléphone. Pour les garder ailleurs : Réglages → Exporter les données.",
    nouveau: "Nouveau téléphone ?",
  },
  programmes: {
    retour: "‹ Séance", titre: "Programmes", enCours: "en cours", creer: "+ Créer un programme",
    bloc: "Chaque programme garde son bloc : y revenir reprend au jour où il en était.",
    actuel: "Programme en cours", passer: (nom: string) => `Passer à ${nom}`,
  },
  apercu: {
    apres: (n: number, avecStats: boolean) =>
      `Après 4 semaines à ${n} séances par semaine, toutes faites${avecStats ? " (aujourd'hui → avec ce programme)" : ""}.`,
    lourdes: (n: number) => `${n} séries lourdes / sem.`,
    lourdesNote: "6 reps au plus, sur les exos qui la font monter",
    parSemaine: (n: number) => `${n} séance${s(n)} / sem.`,
    note: "Mêmes formules que l'onglet Perso, exos en option non comptés. La Force dépend des charges " +
      "soulevées : pas de chiffre d'avance. La Constance compte les semaines où tu fais au moins ce nombre de séances.",
  },
  maj: {
    echec: (e: string) => `Échec de la mise à jour : ${e}`,
    dispo: (v: string) => `ExziFit ${v} est disponible.`,
    mo: (n: string) => `${n} Mo`,
    telechargement: (avancement: string) => `Téléchargement…${avancement}`,
    reessayer: "Réessayer", installer: "Installer",
  },
  alarme: {
    imprecise: "Minuteur imprécis : sans alarme exacte, la vibration de fin peut arriver en retard.",
    autoriser: "Autoriser",
  },
  restaurer: {
    bouton: "Restaurer un export",
    resume: (jour: string, prenom: string | undefined, n: number) =>
      `Export du ${jour}${prenom ? ` (${prenom})` : ""} : ${n} séance${s(n)}.`,
    remplace: "Remplace les données de ce téléphone ; une copie en est gardée dans les sauvegardes.",
    remplacer: "Remplacer mes données", restaurer: "Restaurer",
  },
  reglages: {
    titre: "Réglages", theme: "Thème", navigateur: "navigateur (développement)",
    introuvable: (e: string) => `introuvable : ${e}`, aucune: "aucune", inconnue: (e: string) => `inconnue : ${e}`,
    sexe: "Change le dessin et les références de Force (niveau « très avancé » de chaque sexe).",
    salles: "Salles", salle: (n: number) => `Salle ${n}`,
    machines: (n: number) => `${n} machine${s(n)} réglée${s(n)}`,
    ajouterSalle: "Ajouter une salle",
    sallesNote: "Poids à vide et poulie à moufle se règlent pendant la séance, sous le nom de l'exercice ; la salle " +
      "se choisit sur l'accueil.",
    minuteur: "Minuteur", tester: "Tester la vibration (15 s)", verrouiller: "Verrouiller le téléphone : il doit vibrer à zéro.",
    donnees: "Données", exporter: "Exporter les données", exporte: (x: string) => `Exporté : ${x}`,
    envoyee: (j: string) => `Dernière copie envoyée sur Nextcloud : ${j}`,
    copieLocale: "Copie quotidienne sur ce téléphone ; pour la garder ailleurs, exporter.",
    version: "Version",
  },
  synchro: {
    titre: "Synchro PC ↔ téléphone",
    pasLancee: "pas encore lancée", pasConfiguree: "pas configurée",
    horsLigne: "hors ligne, nouvel essai au prochain retour dans l'app",
    aJour: (quand: string, recues: boolean, envoyees: boolean) =>
      `à jour (${quand})${recues ? ", données reçues" : ""}${envoyees ? ", données envoyées" : ""}`,
    dossier: (etat: string) => `Dossier ExziFit-sync : ${etat}`, enCours: "synchro…",
    maintenant: "Synchroniser maintenant", changer: "Changer de compte",
    explication: "Compte Nextcloud dédié, qui ne voit que le dossier partagé ExziFit-sync. Mot de passe " +
      "d'application : Nextcloud, Paramètres personnels › Sécurité, avec ce compte.",
    serveur: "Serveur", utilisateur: "Utilisateur", mdp: "Mot de passe d'application", inchange: "inchangé",
    enregistrer: "Enregistrer et synchroniser",
  },
  journal: {
    titre: "Journal", libre: "Séance libre", aucune: "Aucune séance terminée.", retour: "‹ Journal",
    poulie: " · poulie double", plusDeSerie: "Plus de série : l'exo sera retiré.", ech: "éch.", test: "test",
    supprimerSerie: "Supprimer la série", corbeille: "L'ancienne version est gardée dans corbeille.json.",
    viderSeance: "Plus de série : supprimer la séance", confirmer: "Confirmer la suppression", supprimer: "Supprimer la séance",
    kgInvalide: (v: string) => `charge « ${v} » invalide`, repsInvalides: (v: string) => `reps « ${v} » invalides`,
    rirInvalide: (v: string) => `RIR « ${v} » invalide`,
    probleme: (exo: string, r: string) => `${exo} : ${r}`,
  },
  perso: {
    palier: (p: number, n: number) => `palier ${p}/${n}`, max: "Palier maximal.",
    suivant: (seuil: number, effet: string) => `À ${seuil} : ${effet}.`, perte: (seuil: number) => ` Sous ${seuil}, il redescend.`,
    nouveau: "nouveau",
    avant: "Personnage il y a 8 semaines", ilYa: "Il y a 8 sem.", aujourdhuiNom: "Personnage aujourd'hui",
    aujourdhui: "Aujourd'hui", meme: "Même silhouette qu'il y a 8 sem.",
    aNoter: "à noter", pesee: (date: string) => `Dernière pesée : ${date}.`,
    sansPesee: "Sans pesée, pas de Force (elle se rapporte au poids de corps).",
    aucunExoForce: "aucun exo de force", peseeManquante: "pesée manquante", pasDeComparaison: "pas encore de comparaison",
    progression4: "Progression sur 4 semaines", aucunExo: "Aucun exo fait ces 14 derniers jours.",
    note: "Calculé depuis le journal, rien n'est crédité : Force sur les 1RM estimés rapportés au poids " +
      "de corps, groupes et Endurance sur les séries dures des 4 dernières semaines, Constance sur " +
      "les 8 dernières semaines. Progression : 1RM estimé des 14 derniers jours comparé à celui d'il y a " +
      "4 à 6 semaines, sur les séries dures ; la stat est la part des exos comparables qui montent d'au moins 1 %.",
  },
  editeur: {
    annuler: "‹ Annuler", modifier: "Modifier", nouveau: "Nouveau programme", nom: "Nom", nomDefaut: "Mon programme",
    explication: "Une rotation de jours : on passe au suivant quand le précédent est fait. Le premier exo de chaque " +
      "jour est le principal (échauffement, plus de repos). Charges calculées en séance, à 2 reps en réserve.",
    jour: (n: number) => `Jour ${n}`, principal: "principal · ",
    reglage: (series: number, min: number, max: number, repos: number) => `${series} × ${min}–${max} · repos ${repos} s`,
    moinsSerie: "une série de moins", plusSerie: "une série de plus", retirer: "retirer",
    ajouterExo: "+ Ajouter un exercice", ajouterExoNom: "Ajouter un exercice",
    retirerJour: "Retirer ce jour", ajouterJour: "+ Ajouter un jour", resultat: "Ce que ça donne",
    manque: (nom: boolean) => `Il manque ${nom ? "un exo dans un jour" : "un nom"}.`,
  },
  seance: {
    titre: "Séance", pdc: "PDC", aCalibrer: "charge à calibrer", repos: (d: string) => `repos ${d}`,
    tentative: (serie: string, reps: number) => `${serie} → tentative suivante (visé : ${reps} à 0 RIR)`,
    ouverture: "Ouverture à 95 % du max estimé.", sansMax: "Pas de max estimé : charge à choisir.",
    monte: "on monte", baisse: "on baisse", meme: "même charge",
    recale: (serie: string, sens: string, reps: number, rir: number) => `${serie} → ${sens} (visé : ${reps} reps à ${rir} RIR)`,
    ratee: "Série ratée : charge allégée de 10 % pour les séries en plus.",
    terminee: "Séance terminée",
    bilan: (min: number, series: number, volume: string) => `${min} min · ${series} séries · ${volume} kg soulevés`,
    record: (nom: string, kg: string) => `Record : ${nom}, 1RM estimé ${kg} kg`,
    recordAvant: (kg: string) => ` (avant ${kg})`,
    changerProgramme: "Changer de programme ›", optionnel: " (optionnel)",
    aRattraper: (n: number) => `+ ${n} à rattraper en fin de séance (plus bas)`,
    sautes: (n: number) => `${n} exo${s(n)} sauté${s(n)} à rattraper (plus bas)`,
    rattrapage: "Rattrapage", rattrapageNote: "Sauté ces derniers jours. Coché = ajouté en fin de séance.",
    plusTard: (nom: string, jour: string, raison: string) => `${nom} (${jour}), plus tard : ${raison}`,
    echauffement: (min: number) => `Échauffement · ≈ ${min} min`,
    echauffementNote: "Puis la barre à vide et les séries d'approche, affichées à la saisie du premier exercice.",
    blocTermine: "Bloc terminé",
    blocNote: "Démarrer ouvre un nouveau bloc en S1, avec ces 1RM (test du bloc, sinon meilleur estimé) :",
    rmSuivant: (nom: string, v: string | null) => `${nom} : ${v ?? "à calibrer"}`,
    libre: "Séance libre (sans programme)", libreTitre: "Séance libre",
    derniere: (date: string) => `Dernière séance : ${date}`,
    nouveauBloc: "Nouveau bloc · ", demarrer: "Démarrer ",
    confirmerFin: "Confirmer la fin", terminer: "Terminer la séance",
    pourquoi: { programme: "prévu par le programme", mouvement: "même mouvement", muscles: "mêmes muscles" },
    retour: "‹ Retour", remplacerExo: (nom: string) => `Remplacer ${nom}`, ajouterExercice: "Ajouter un exercice",
    gardees: (reste: number, n: number) => `Séries déjà faites gardées : il en reste ${reste} sur ${n}.`,
    autres: "Autres exercices", top: "top", rattrapageBadge: (j: string) => `rattrapage ${j}`, ajouterExo: "Ajouter un exo",
    remplacer: "Remplacer",
    test: (nom: string, n: number) => `Test de ${nom} · tentative ${n}`,
    serie: (i: number, n: number, cible: string) => `Série ${i}/${n} · ${cible}`,
    serieEnPlus: (i: number, cible: string) => `Série ${i} (en plus) · ${cible}`,
    superset: (noms: string) => `Superset avec ${noms}`,
    pdcManquant: "Poids de corps manquant (à noter sur l'accueil).",
    calibrage: "Calibrage : l'app monte la charge à chaque série selon ton RIR. Les paliers à 4+ comptent en échauffement.",
    calibre: "Calibré : la charge suit ton RIR série après série.",
    echauffementExo: (etapes: string) => `Échauffement : ${etapes}`,
    disquesCote: "disques par côté", parCote: "par côté",
    jamaisDepart: "Jamais fait : mets ta charge de départ, la prochaine fois elle sera préremplie.", jamais: "Jamais fait.",
    go: "Go", moinsRep: "une rep de moins", plusRep: "une rep de plus", repsFaites: "reps faites",
    reserve: "Reps en réserve ?", tentativeBouton: (kg: string, reps: number) => `Tentative · ${kg} × ${reps}`,
    passerTest: "Passer le test", enPlus: (kg: string, reps: number) => `Série en plus · ${kg} × ${reps}`,
    suivant: (nom: string) => `Suivant : ${nom}`, enOption: "en option · si tu as encore du jus",
    valider: (kg: string, reps: number) => `Valider ${kg} × ${reps}`,
    moinsCharge: "moins de charge", plusCharge: "plus de charge", reps: "reps",
  },
  machine: {
    aVide: (kg: string) => `${kg} kg à vide`, aVideNonNote: "poids à vide non noté",
    moufle: "poulie à moufle (pile × 2)", normale: "poulie normale",
    manque: "Poids à vide pas encore noté ici : sans lui, 1RM, % et Force sont sous-estimés. Il est souvent écrit sur le chariot.",
    champ: "Poids à vide (chariot, barre de la Smith)",
    disquesNote: "Note les disques seuls : l'app ajoute ce poids pour le 1RM, les % et les stats.",
    normaleBouton: "Normale", moufleBouton: "Moufle", pile2: "pile × 2",
    moufleNote: "Note toujours le chiffre de la pile. Moufle : la pile affiche le double de ce que tu tires " +
      "(26 kg ailleurs = 52 kg ici) ; l'app divise par deux pour comparer tes salles.",
  },
  rm: {
    titre: "1RM du bloc", aSaisir: (n: number) => ` · ${n} à saisir ou calibrer`, peseeManquante: " · pesée manquante",
    leste: " (corps + lest)", aVide: (kg: string) => ` (disques + ${kg} à vide)`, calibrer: "calibrer",
    note: "Vide = estimé depuis ta dernière séance (≈), sinon montée guidée en séance. Le 1RM des % ne baisse " +
      "jamais : la dernière séance du bloc le relève si elle a fait mieux (Epley avec la réserve).",
  },
  /** Textes calculés par donnees/programme.ts. */
  calculs: {
    ecart: (y: string, h: number, heures: number, x: string) => `${y} il y a ${h} h : ${heures} h conseillées avant ${x}.`,
    auJour: (y: string, heures: number, x: string) => `${y} au programme du jour : ${heures} h conseillées avec ${x}.`,
    pdcFois: (reps: number) => `PDC ×${reps}`, barre: "Barre ×15", aVide: "À vide ×15",
    mobilite: [
      "Cercles de bras · 10 dans chaque sens", "Squat au poids du corps · 10", "Pompes lentes · 8",
      "Y-T-W debout, bras tendus · 5 de chaque", "Good morning mains sur la nuque · 10",
      "Balancements de jambe · 10 par côté", "Montées sur pointes · 15", "Cercles de poignets · 10",
    ],
    phrases: [
      "Exo bouclé. Bois un coup, on enchaîne.",
      "Propre. Même technique sur le suivant.",
      "Fait. Ce sont les séries comme celle-là qui font le bloc.",
      "Bien tenu. Respire, le suivant attend.",
      "Coché. Une ligne de plus dans le journal.",
      "Solide. Garde ce rythme.",
    ],
    record: (kg: string, avant: string) => `Record : 1RM estimé ${kg} kg (avant ${avant}).`,
    plusKg: (kg: string) => `+${kg} kg par rapport à la dernière fois.`,
    plusReps: (n: number) => `${n} rep${s(n)} de plus que la dernière fois.`,
  },
  /** Libellé sous le champ charge (exercices.ts, `libelleCharge`). */
  charge: { leste: "lest kg", disques: "disques", pile: "pile", kg: "kg" },
  objectifs: { force: "Force", hypertrophie: "Hypertrophie", endurance: "Endurance" },
  themes: { braise: "Braise", nuit: "Nuit", foret: "Forêt", craie: "Craie (clair)" },
  stats: { force: "Force", endurance: "Endurance", constance: "Constance", progression: "Progression" },
  muscles: {
    pectoraux: "Pectoraux", dos: "Dos", epaules: "Épaules", biceps: "Biceps", triceps: "Triceps",
    quadriceps: "Quadriceps", ischios: "Ischios", fessiers: "Fessiers", mollets: "Mollets",
    abdos: "Abdos", "avant-bras": "Avant-bras",
  },
  /** Ce que chaque palier change sur le personnage (avatar.ts, `SEUILS`), du palier 1 au dernier. */
  effets: {
    force: ["épaules plus larges", "bras plus épais, pectoraux", "biceps, jambes plus épaisses", "carrure maximale", "trapèzes, veines"],
    endurance: ["taille affinée", "ligne d'abdos", "abdos dessinés"],
    constance: ["posture droite, teint vif", "halo"],
  },
  salleDefaut: "Ma salle",
  minuteur: {
    fin: "Repos terminé", suivante: "Série suivante",
    permission: "permission de notification refusée : le minuteur ne pourra pas vibrer",
  },
  fichier: {
    pasExport: "Ce fichier n'est pas un export ExziFit (JSON illisible).",
    illisible: "Ce fichier n'est pas un export ExziFit lisible par cette version.",
  },
  /** Noms d'exercices par id, quand ils diffèrent du catalogue (exercices.ts). */
  exos: {} as Record<string, string>,
  /** Textes des programmes du code (JSON en français) : texte français → traduction. */
  programmesTextes: {} as Record<string, string>,
};

export type Textes = typeof fr;
