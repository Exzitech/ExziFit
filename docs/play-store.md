# Google Play : bascule et démarches

État au 2026-10-17 : l'app est prête à compiler pour Google Play (`npm run publier-play`, voir le
README, « Dev et prod ») ; **aucun compte Play Console n'existe encore**. Ce qui suit est à faire
par Tom, dans l'ordre.

## 1. Bascule des téléphones (une fois)

- **Ton téléphone** garde ExziFit (identifiant prod, 0.1.43, ton vrai historique). Installer
  à côté **ExziFit Dev** depuis le dossier Nextcloud `ExziFit` (`ExziFit-dev.apk`) : c'est elle qui
  reçoit désormais les mises à jour Nextcloud. Ses données partent de zéro (Réglages › Restaurer un
  export de l'app prod pour essayer sur de vraies données, sans risque pour elles).
- **Les potes** gardent ExziFit (identifiant prod), mise à jour par Nextcloud (`npm run
  publier-potes`, canal potes du README) tant qu'il n'y a pas de compte. Dès qu'ils sont testeurs (étape 4), le Play Store remplace l'app **sans perdre leurs
  données**, parce que la clé de signature est la même.
- Avant la première installation depuis le Play Store : **Réglages › Exporter** sur chaque
  téléphone, par précaution.

## 2. Compte développeur

- [Play Console](https://play.google.com/console), 25 $ une fois, vérification d'identité.
- Compte **personnel** créé depuis fin 2023 : Google exige un **test fermé d'au moins 12 testeurs
  pendant 14 jours** avant d'ouvrir la production. Compter les potes et leur entourage.
- Compte **organisation** : pas ce test obligatoire, mais un numéro D-U-N-S.

## 3. Créer l'app

- Nom « ExziFit », langue par défaut français, application (pas jeu), gratuite. La gratuité
  d'une app ne peut plus être retirée ; le Pro passera par un achat intégré (CLAUDE.md, « Freemium »).
- **Signature** (Configuration › Intégrité de l'app) : choisir **utiliser ma propre clé**, puis
  exporter `C:\Users\tomro\.android\exzifit-release.jks` avec l'outil PEPK que la console fournit.
  C'est ce qui permet au Play Store de mettre à jour les installations actuelles. Ce choix ne se
  refait pas : vérifier d'abord la copie de la clé dans `ExziFit-prive` (README, « Travailler sur
  un autre poste »). La même clé sert de clé d'importation.

## 4. Contenu de l'app (formulaires obligatoires)

- **Règles de confidentialité** : une adresse publique est obligatoire (app de santé). Texte prêt :
  [confidentialite.md](confidentialite.md), lisible en ligne sur GitHub une fois sur `main`.
- **Sécurité des données** : aucune donnée collectée ni partagée ; tout reste sur l'appareil. La
  version Play n'envoie rien sur le réseau (ni Nextcloud ni synchro, voir le README).
- **Applis de santé** : déclarer la catégorie suivi d'activité / forme physique.
- Classification du contenu (questionnaire), public cible **18 ans et plus** (évite les règles
  « Familles »), pas de publicité.
- Fiche : description courte et longue, icône 512 × 512, bannière 1024 × 500, au moins deux
  captures de téléphone.

## 5. Publier une version

1. Sur `main`, propre : `npm run publier-play` → `livraisons/ExziFit-X.Y.Z.aab` et tag `vX.Y.Z`.
2. Play Console › Tests › **Test interne** › Créer une version › déposer l'AAB. Disponible en
   quelques minutes pour les testeurs inscrits (jusqu'à 100, par adresse Gmail).
3. Installer depuis le Play Store, vérifier **à la salle** (minuteur téléphone verrouillé, saisie).
4. Promouvoir vers **test fermé**, puis **production** (examen de Google : de quelques heures à
   quelques jours).
5. `git push origin main vX.Y.Z`.

Chaque AAB envoyé doit avoir une version plus récente que le précédent (Google refuse un numéro
déjà utilisé, même pour une version retirée) : `publier-play` le vérifie contre les tags.
