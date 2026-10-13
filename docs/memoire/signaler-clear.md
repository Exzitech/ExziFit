---
name: signaler-clear
description: Tom veut que Claude lui dise explicitement quand faire /clear sur ExziFit
metadata:
  node_type: memory
  type: feedback
  originSessionId: bde48591-e9bd-4289-a3ab-5c0a64777b46
  modified: 2026-10-13T01:10:52.040Z
---

Dire à Tom, en fin de message, quand c'est le bon moment pour `/clear` : à la fin d'une étape
dont tout l'état utile est écrit dans CLAUDE.md / PROGRESS.md / docs, avant un nouveau chantier,
ou quand le contexte a beaucoup grossi (gros fichiers lus, longues sorties).

**Why:** demandé par Tom le 2026-10-13 (« n'oublie pas de me dire quand clear ») ; il ne
surveille pas lui-même la taille du contexte.
**How to apply:** avant de conseiller le clear, vérifier que PROGRESS.md est à jour (prochaine
étape incluse), puis l'écrire clairement : « Bon moment pour /clear ».
