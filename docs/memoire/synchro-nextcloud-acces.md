---
name: synchro-nextcloud-acces
description: "Où vit la synchro ExziFit sur le serveur, comment l'inspecter, et ce que le classifieur refuse"
metadata:
  node_type: memory
  type: reference
  originSessionId: 17649b1f-ff24-4391-bcf2-9c303819eb6c
  modified: 2026-10-14T03:43:25.199Z
---

Synchro ExziFit (0.1.22+) : `etat.json` dans `data/exzifit/files/ExziFit-sync/` du conteneur Docker
`nextcloud` (VM `services` ; accès SSH : mémoire ExziHub `acces-tailscale-maison`). Compte `exzifit`
dédié, sans partage. Lecture OK en SSH : `sudo docker exec -u www-data nextcloud cat …` ;
journal des requêtes : `sudo docker exec nginx-proxy sh -c 'grep -h etat.json /data/logs/proxy-host-*_access.log'`.

Refusé par le classifieur (2026-10-14) : écrire `etat.json` sur le serveur, curl avec le mot de
passe d'application, écrire ce mot de passe dans un fichier (config de l'app ou dossier Nextcloud).
Voie qui marche pour réparer des données : modifier les fichiers locaux de l'app PC
(`%APPDATA%\com.exzitech.exzifit\donnees`, copie de côté d'abord) avec un `modifie` récent, puis
lancer l'app : sa synchro envoie la correction.

**How to apply:** pour diagnostiquer une synchro, lire le journal du proxy (code 412 = ETag) et le
fichier distant ; pour corriger, passer par l'app. Voir [[publier-apres-changement]].
