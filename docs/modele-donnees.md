# Modèle de données — ExziFit

Validé par Tom le 2026-10-13. **Implémenté** : exercices de base, journal, séance en cours,
`blocs.json`, `poids.json`, prescriptions et rotation, avertissements des règles `ecart`,
semaine de test et fin de bloc. Le programme est lu depuis le code
(`src/donnees/programmes/bloc-force.json`), pas encore depuis `programmes.json`. Reste :
éditeur de programmes, exercices perso.
Validée sur papier par la transcription
du Bloc Force : [src/donnees/programmes/bloc-force.json](../src/donnees/programmes/bloc-force.json).

## Principes

1. **On stocke ce qui s'est passé, on calcule le reste.** Le fichier ne contient que des faits
   (séries faites, programmes écrits, 1RM figés au début d'un bloc, poids de corps). Tout le
   reste est recalculé à chaque lancement : position dans la rotation, semaine du bloc, 1RM
   estimé, prochaine charge, stats du personnage. Une seule source de vérité, et une stat ne
   peut pas être « créditée » (CLAUDE.md, principe non négociable).
2. **JSON indenté, noms en français, kg et secondes**, dates ISO 8601 avec fuseau
   (`2026-10-14T18:02:11+02:00`). Relisible et corrigeable à la main.
3. **Chaque fichier porte `"format": 1`.** Une migration lit le numéro, écrit d'abord une copie
   horodatée dans `sauvegardes/`, puis réécrit le fichier au numéro suivant.
4. **Écriture atomique** : `.tmp` puis renommage (validé par le prototype).
5. **Le passé ne se réécrit pas** : un mois terminé n'est plus jamais rouvert en écriture.

## Fichiers (dossier `donnees/` de l'app)

| Fichier | Contenu | Écrit quand |
|---|---|---|
| `journal/2026-10.json` | les séances faites ce mois-là (mois du début de séance) | en fin de séance (mois courant) ; à une correction ou suppression depuis l'onglet Journal (mois de la séance) |
| `corbeille.json` | versions des séances remplacées ou supprimées depuis l'onglet Journal (`le` + `seance`), à recopier à la main pour annuler | avant chaque correction ou suppression |
| `en-cours.json` | la séance en cours, pour survivre à un kill de l'app | à chaque série ; supprimé en fin de séance |
| `programmes.json` | les programmes écrits | à l'édition d'un programme |
| `blocs.json` | historique des blocs lancés, avec leurs 1RM figés | au début / à la fin d'un bloc |
| `exercices.json` | exercices **perso** uniquement | à la création d'un exercice |
| `poids.json` | pesées | à chaque pesée |
| `reglages.json` | thème, disques disponibles, barre | dans les réglages |
| `sauvegardes/` | copies datées de tout le dossier | au lancement, une fois par jour |

Les exercices de base sont **dans le code** (identifiants stables : `developpe-couche`,
`souleve-de-terre`…). Un exercice perso a le même format, préfixé `perso-`.

Volume attendu : ~5 000 séries par an, ~50 Ko par mois de journal. Tout recharger au lancement
reste de l'ordre de la milliseconde pendant des années ; aucun index ni base de données.

## Exercice

```json
{
  "id": "tractions-lestees",
  "nom": "Tractions lestées",
  "charge": "poids-corps-leste",
  "pas": 2.5,
  "muscles": { "principaux": ["dos"], "secondaires": ["biceps"] },
  "force": true
}
```

- `charge` : `barre` (barre + disques, affiche les disques par côté), `halteres`, `machine`,
  `poulie`, `poids-corps-leste` (1RM = corps + lest), `poids-corps`, `distance` (farmer's walk).
- `pas` : arrondi des charges proposées pour cet exercice.
- `force: true` : compte dans la stat Force (gros mouvements).
- Groupes musculaires (liste fermée, pour la stat par groupe) : `pectoraux`, `dos`, `epaules`,
  `biceps`, `triceps`, `quadriceps`, `ischios`, `fessiers`, `mollets`, `abdos`, `avant-bras`.

## Programme

Une **rotation de jours** et, en option, des **semaines** qui changent les %.
Un programme sans périodisation a une seule semaine, répétée.

```json
{
  "id": "bloc-force",
  "nom": "Bloc Force",
  "semaines": [
    { "nom": "S1", "label": "Calib.", "schemas": { "std": { "series": 5, "reps": 5, "pct": [0.80] } } }
  ],
  "jours": [
    {
      "id": "J1", "nom": "Bench lourd", "objectif": "force", "lourd": true, "optionnel": false,
      "exercices": [
        { "exo": "developpe-couche", "role": "principal",
          "prescription": { "type": "pct1rm", "schema": "std" }, "repos": 240 },
        { "exo": "dips-lestes",
          "prescription": { "type": "fourchette", "series": 3, "repsMin": 6, "repsMax": 8, "rir": 2 },
          "repos": 180 },
        { "superset": ["curl-poulie-basse", "extension-corde-nuque"],
          "prescription": { "type": "fourchette", "series": 3, "repsMin": 10, "repsMax": 10, "rir": 2 },
          "repos": 90 }
      ]
    }
  ],
  "regles": [
    { "type": "ecart", "exos": ["hack-squat", "souleve-de-terre"], "heures": 48 },
    { "type": "max-lourds-consecutifs", "jours": 5 }
  ],
  "notes": ["1 à 2 reps en réserve sur chaque série. Jamais à l'échec."]
}
```

**Prescriptions** (comment l'app calcule la charge proposée) :

| `type` | Charge proposée | Progression |
|---|---|---|
| `pct1rm` | % du 1RM du bloc **relevé** par la dernière séance du bloc (jamais baissé), schéma de la semaine en cours ; en séance, chaque série recale la suivante sur le RIR visé (1) | change avec la semaine et les séries réelles |
| `fourchette` | dernière charge faite sur cet exo | double progression (toutes séries en haut de fourchette avec RIR ≥ cible → un `pas` de plus ; sinon même charge, +1 rep visée) |
| `rpe` | tirée du 1RM estimé courant et du RPE visé ; en séance, recalée série par série (RIR visé = 10 − RPE) | suit le 1RM estimé |
| `distance` | dernière charge, distance fixe (`metres`) | manuelle |

`pct` à une valeur = charge fixe ; à deux valeurs (`[0.88, 0.90]`) = **fourchette** : l'app
propose le bas de la fourchette, affiche « 88–90 % », et le − / + reste libre (décidé le 2026-10-13).

Une semaine peut porter `"test": { "developpe-couche": 1, "*": 3 }` : après les séries
prévues, un test de 1RM ou de 3RM par exo principal, dont le résultat devient le 1RM proposé
pour le bloc suivant. Un exo n'est testé qu'une fois par bloc (le bench du J5 ne l'est plus après
le J1). Les tentatives sont des séries de `travail` marquées `"test": true` ; résultat = meilleure
tentative à 0 RIR (single = sa charge), sinon meilleur Epley des tentatives avec réserve.

Champs optionnels sur un exercice de jour : `optionnel`, `note` (« Face pull si l'épaule grince »),
`alternatives` (exos de remplacement proposés quand la machine est prise).

`objectif` (`force` / `hypertrophie` / `endurance` / `superset`) ne sert qu'**à la création**
d'un jour : il préremplit fourchettes, repos et RIR. Il est gardé pour l'affichage.

Les **échauffements** et les **disques par côté** ne sont pas stockés : ils dépendent du type
de charge et se calculent (barre ×10, 40 % ×5, 60 % ×3, 75 % ×2 ; lesté : PDC ×5, ½ lest ×3).

## Bloc (instance d'un programme)

`blocs.json` — l'unique endroit où un 1RM est **saisi**, une fois, au lancement du bloc :

```json
{
  "format": 1,
  "blocs": [
    { "id": "2026-10-14-bloc-force", "programme": "bloc-force", "debut": "2026-10-14",
      "fin": null, "rm": { "developpe-couche": 160, "tractions-lestees": 135 } }
  ]
}
```

Un exo `pct1rm` sans 1RM dans le bloc prend le 1RM estimé de la dernière séance où il a été
fait. Jamais fait : **montée guidée** en séance (paliers à +20 % tant que le RIR est 4+, notés
`echauffement`), jusqu'à une série fiable. Rien n'est écrit dans `blocs.json` : le 1RM utilisé
(`rmEffectif`) est recalculé depuis le journal, = max(1RM du bloc, estimé de la dernière séance
du bloc) — la surcharge progressive suit les séries réelles, une mauvaise séance ne fait pas
reculer les suivantes (décidé le 2026-10-13, remplace « figé au début du bloc »).

**Fin de bloc** : quand la dernière séance du bloc est en dernière semaine et que le jour choisi
relance la rotation, Démarrer écrit `fin` (jour local) sur le bloc et ouvre le suivant en S1, avec
`rm` = résultat du test du bloc, sinon 1RM effectif, arrondi au demi-kilo. Pas de migration :
`fin` existait déjà, toujours `null` jusqu'ici.

## Séance faite (journal)

```json
{
  "format": 1,
  "seances": [
    {
      "debut": "2026-10-14T18:02:11+02:00",
      "fin": "2026-10-14T19:15:40+02:00",
      "bloc": "2026-10-14-bloc-force", "semaine": 0, "jour": "J1",
      "exercices": [
        {
          "exo": "developpe-couche",
          "series": [
            { "type": "echauffement", "kg": 60, "reps": 5 },
            { "type": "travail", "kg": 127.5, "reps": 5, "rir": 2,
              "prevu": { "kg": 127.5, "reps": 5 }, "a": "2026-10-14T18:14:03+02:00" }
          ]
        },
        { "exo": "face-pull", "remplace": "ecarte-inverse-poulie", "series": [] }
      ]
    }
  ]
}
```

- `poulie` (optionnel, `2`) : salle à poulie double (moufle). Sur les exos `charge: "poulie"`,
  `kg` est la **charge effective** (pile ÷ 2) : les calculs comparent les salles sans conversion,
  seul l'écran multiplie. Absent = poulie simple. Ajouté le 2026-10-13, pas de migration.
- `test` (optionnel, `true`) : tentative du test de fin de bloc. Champ ajouté le 2026-10-13,
  absent des anciennes séances : pas de migration.
- `prevu` : ce que l'app avait proposé. Sert à mesurer le point 3 de la v1 (« assez bonne
  pour être suivie sans discuter ») : part des séries faites telles que proposées.
- `remplace` : exo remplacé (machine prise) ; la progression reste celle de l'exo réellement fait.
- `semaine` et `jour` sont recopiés au moment de la séance : ce sont des faits, la rotation
  future se déduit de la dernière séance du bloc.
- `rir` absent sur l'échauffement ; série au poids de corps lestée : `kg` = lest seul.

## Ce qui se calcule (jamais stocké)

- **Jour suivant** : celui qui suit la dernière séance du bloc. Le jour optionnel est sauté
  au-delà de `max-lourds-consecutifs`. **Semaine** : rotations complètes du bloc.
- **1RM estimé** : meilleur Epley avec réserve, `kg × (1 + (reps + rir) / 30)`, sur les séries
  de travail récentes (fenêtre à fixer dans le code, testée).
- **Charge proposée** : selon la prescription, arrondie au `pas`.
- **Avertissements** des règles (« hack squat il y a 30 h »).
- **Stats du personnage**, à partir du journal et des pesées, avec décroissance quand
  l'entraînement s'arrête. Formules : [stats.md](stats.md).

## Hors du modèle pour l'instant

- Sauvegarde **hors du téléphone** (décidé le 2026-10-13) : envoi automatique du dossier de
  données sur le Nextcloud de Tom dès que le réseau est là, en reprenant le code WebDAV
  d'ExziHub. Jamais bloquant : la saisie reste 100 % hors ligne, un envoi raté se retente plus
  tard et se signale. Format exact (copie datée ou miroir) à fixer avec le squelette.
- L'avatar pixel art : pur affichage calculé depuis les stats, rien à stocker.
