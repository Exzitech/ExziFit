# Stats du personnage — formules

**Statut : validé par Tom le 2026-10-13 (Force relative, Endurance = capacité de travail,
Constance selon le programme). Codé dans `src/donnees/stats.ts`, affiché dans l'onglet « Perso » et le résumé de fin de séance (0.1.13).**

Lire d'abord [CLAUDE.md](../CLAUDE.md), « Le principe qui ne se négocie pas ». Chaque stat est
une fonction pure de `journal/*.json` et `poids.json` à une date donnée : rien n'est stocké,
rien ne se crédite, et la même date redonne toujours le même résultat.

## Ce que chaque stat ne doit pas récompenser

| Stat | Piège à éviter | Garde-fou |
|---|---|---|
| Force | PR à tout prix, singles risqués | 1RM **estimé** sur séries ≤ 10 reps, un single n'apporte rien de plus qu'un 5 × 3 RIR bien fait |
| Groupes | volume poubelle | seules les séries **dures** (RIR ≤ 3) comptent, **plafond** à 10 séries / semaine / groupe |
| Constance | série de jours | fenêtre glissante de 8 semaines, une semaine manquée coûte 1/8 et se rattrape |

## Briques communes

- **Série dure** : `type: "travail"`, RIR ≤ 3 (RIR absent = compte, données anciennes).
  Échauffements et paliers de montée guidée exclus.
- **e1RM d'une série** : la fonction existante (`e1rmSerie`, programme.ts) : Epley avec réserve,
  single à 0 RIR = sa charge ; corps + lest sur les lestés (pesée la plus proche avant la série).
  Seulement les séries ≤ 10 reps (Epley dérive au-delà).
- **Échelle** : 0 à 100, affichée en 10 cases. Pas de plafond de calcul (un 120 reste 120),
  la barre est simplement pleine.

## Force

Lecture : « quelle charge je soulève, rapportée à mon poids ».

1. Pour chaque exo qui a une part de Force (`force` dans `exercices.ts`) déjà fait au moins une fois :
   `e1RM retenu = max sur toutes ses séries dures de e1RM(série) × usure(âge de la série)`.
2. `usure(âge)` = 1 jusqu'à 21 jours, puis −1 % par semaine (exponentiel), jamais sous 0,7.
   Raison : la force se maintient environ 3 semaines sans entraînement puis baisse lentement ;
   un retour à la salle remet immédiatement la vraie valeur (la nouvelle série l'emporte).
3. `score exo = 100 × (e1RM retenu / poids de corps) / référence exo`.
4. **Force = moyenne des scores exo pondérée par leur coefficient** (demande de Tom, 2026-10-15 :
   chaque exo compte plus ou moins, au lieu de cinq gros mouvements seulement). Un exo jamais fait
   n'entre pas dans la moyenne (un programme sans hack squat n'est pas pénalisé).

Charges réelles (poids à vide de la machine et moufle de la salle appliqués), **par haltère** pour
les haltères, corps + lest pour les lestés. Références = niveau « très avancé » naturel (× poids
de corps) ; celles des machines et poulies sont indicatives (elles dépendent de la machine), d'où
leur faible coefficient. Les isolations à plus de 10 reps n'entrent pas (règle des ≤ 10 reps).

| Coefficient | Exos (référence) |
|---|---|
| 1 — gros mouvements | Développé couché 1,75 · Militaire barre 1,1 · Soulevé de terre 2,75 · Tractions lestées 1,75 · Hack squat 3 · Back squat 2,5 |
| 0,5 — polyarticulaires secondaires | Couché Smith 1,75 · Militaire Smith 1,1 · Militaire haltères 0,45 · Incliné haltères 0,55 · Squat Smith 2,25 · Goblet squat 0,8 · Split squat 0,7 · Fentes marchées 0,5 · Couché haltères 0,7 · Développé machine 1,5 · Tirage vertical 1 · Rowing poulie 1,2 · Presse 4 · Soulevé roumain 2 · Tirage vertical prise neutre 1 · Rowing barre 1,5 · Rowing haltère 0,8 · Dips lestés 2 · Fentes bulgares 0,6 · Hip thrust 3 |
| 0,25 — isolation | Leg curl allongé 1 · assis 1,1 · Leg extension 1,25 · Mollets debout 2,5 · Mollets assis 1,5 · Élévations latérales 0,15 · Écarté poulie 0,2 · Pullover poulie 0,4 · Écarté inversé 0,15 · Face pull 0,5 · Curl poulie 0,6 · Curl marteau 0,35 · Curl incliné haltères 0,2 · Extension poulie haute 0,75 · Extension corde nuque 0,6 · Crunch poulie 1 |
| aucun | Dips et tractions australiennes sans lest, relevé de jambes, farmer's walk |

**Femme** (réglage `sexe`, 2026-10-15) : référence × **0,8** si l'exo a un groupe du bas du corps
(quadriceps, ischios, fessiers, mollets) parmi ses principaux, × **0,65** sinon. Force 100 reste
« très avancée » dans son sexe, et les seuils du personnage restent communs. Rapports tirés de
mémoire des tableaux de niveaux usuels (Strength Level : femme ≈ 0,6–0,65 de l'homme au couché et
au militaire, ≈ 0,75–0,8 au squat et au soulevé), pas vérifiés sur source ; à revoir si une amie
s'en sert.

Sans pesée : Force non calculée (affichée « pesée manquante »), plutôt qu'un poids inventé.

## Groupes musculaires

Lecture : « est-ce que ce muscle reçoit une dose efficace ».

- Fenêtre : les 28 derniers jours. Chaque série dure compte **1** pour les groupes `principaux`
  de l'exo, **0,5** pour les `secondaires`.
- `score groupe = 100 × min(séries / 4, 10) / 10` (séries par semaine, plafond à 10).
- Pas d'usure à part : la fenêtre glissante fait descendre le score dès qu'on s'arrête.

## Endurance

**Capacité de travail** = moyenne des scores des 11 groupes. Elle monte quand tout le corps reçoit sa dose, elle ne monte
plus au-delà (plafond par groupe), et elle baisse en 4 semaines d'arrêt.

## Constance

Lecture : « est-ce que je viens ».

- 8 tranches de 7 jours glissants en remontant depuis maintenant.
- Une tranche est **tenue** si elle contient au moins `seuil` séances terminées.
- `seuil` = moitié des jours non optionnels du programme du bloc ouvert, arrondie au-dessus
  (une rotation compte pour une semaine : Bloc Force, 5 jours → 3) ; sans bloc ouvert, 2.
  Le seuil se lit au moment du calcul et s'applique aux 8 tranches (simple ; un changement de
  programme recalcule donc tout l'historique de la fenêtre).
- **Constance = 100 × tranches tenues / 8.**

Une semaine sous le seuil coûte 12,5 et revient 8 semaines plus tard sans rien faire de spécial ;
aucune notion de « série en cours » ni de compteur qui repart à zéro.

## Aperçu d'un programme

Page « Programmes » (accueil → « Changer de programme », 0.1.35) : ce que donneraient 4 semaines du
programme, à côté des stats du jour. `apercu` (stats.ts), mêmes formules que ci-dessus :

- Une rotation par semaine : chaque jour non optionnel une fois, postes obligatoires seulement,
  toutes les séries comptées dures. Programme à plusieurs semaines : moyenne de ses semaines.
- **Groupes** et **Endurance** : séries par semaine → même score que plus haut (testé contre
  `stats` sur 4 semaines simulées).
- **Force** : pas de chiffre (elle dépend des charges). Affiché : séries de 6 reps au plus par
  semaine sur les exos qui ont une part de Force.
- **Constance** : le seuil du programme (séances par semaine pour qu'une tranche compte).

## Progression

Lecture : « est-ce que mes charges montent ». Ajoutée le 2026-10-13 (demande de Tom : une fois la
dose des groupes atteinte, plus rien ne bougeait, et la Force ne voyait que 5 mouvements).

- **Par exo** : meilleur 1RM estimé des **14 derniers jours** comparé à celui d'il y a **28 à
  42 jours**, sur les séries dures de 15 reps au plus. On compare un exo à lui-même, donc pas de
  référence par exo (poulies et machines comprises) ; 15 reps au lieu de 10 pour garder les
  accessoires. Corps compté sur les exos au poids du corps (pesée de la série), ignorés sans
  pesée ; distances ignorées. Affiché « ▲ +6 % », « ▼ −2 % », « = » (moins de 1 % d'écart),
  « nouveau » (pas fait 4 semaines plus tôt).
- **Stat Progression = 100 × exos qui montent d'au moins 1 % / exos comparables** (faits dans les
  deux fenêtres). Non calculée sans exo comparable.

Garde-fous : une série ratée ou une décharge ne coûte rien (meilleure série sur 14 jours, séries
à RIR 4+ exclues) ; arrêter ou stagner la fait baisser. Les poulies doubles sont notées en charge
effective (voir le modèle de données, `poulie`) : changer de salle ne fausse pas l'écart.

## Ce qui en sort

- Le résumé de fin de séance affiche l'écart de chaque stat avant / après la séance.
- Le personnage lit des paliers sur ces scores (voir « Personnage » ci-dessous).
- Tests unitaires : usure, plafond des groupes, tranches de Constance, exo jamais fait,
  pesée manquante, single à 0 RIR.

## Personnage

Sprite de 24 × 27 pixels, symétrique, recalculé à chaque affichage depuis les paliers
(`src/donnees/avatar.ts`). Palier = nombre de seuils atteints ; une stat absente (Force sans
pesée) compte pour 0. Il redescend dès que le score repasse sous le seuil.

| Stat | Seuils | Ce qui change |
|---|---|---|
| Force | 40 · 55 · 70 · 85 | épaules plus larges ; bras plus épais et pectoraux ; biceps et jambes ; carrure maximale |
| Endurance | 25 · 50 · 75 | taille plus fine ; taille fine et ligne d'abdos ; abdos dessinés |
| Constance | 50 · 75 | sous 50 tête rentrée, cernes, teint terne ; puis posture droite ; à 75 halo à la couleur du thème |

Seuils de Force serrés au milieu de l'échelle (100 = très avancé), là où se trouve un pratiquant
intermédiaire, pour qu'un vrai progrès se voie en quelques mois. Constance 75 = 6 semaines tenues
sur 8. Seuils posés sans données réelles, à revoir après quelques semaines d'usage.

**Femme** : même grille et mêmes traits, plus cheveux longs jusqu'aux épaules, brassière à
l'accent sur le haut du torse et short élargi d'un pixel (hanches).

L'onglet Perso montre aussi le personnage calculé 8 semaines plus tôt (mêmes formules, à cette
date) quand sa silhouette diffère, et pour chaque stat le seuil du prochain palier et celui sous
lequel il redescend. Couleurs : peau et cheveux fixes (variables `--peau`, `--cheveux`, comme les
disques), short à l'accent du thème.

## Décidé

- Force **relative** au poids de corps : une prise de masse la fait baisser à charge égale (vrai).
- Endurance = **capacité de travail** (pas de cardio en v1, l'endurance musculaire resterait basse
  sur un programme de force).
- Constance : seuil **selon le programme**, pas un chiffre fixe.
