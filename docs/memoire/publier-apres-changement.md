---
name: publier-apres-changement
description: "ExziFit — après un changement de l'app validé, publier directement avec npm run publier, sans demander"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 72fecb46-8366-40a4-9a19-87e7a94c1b1a
  modified: 2026-10-13T01:36:18.139Z
---

Après chaque changement de l'app ExziFit (build et tests verts), lancer `npm run publier`
sans demander : Tom installe l'APK une seule fois et reçoit ensuite les mises à jour dans l'app.

**Why:** demande de Tom le 2026-10-13 (« à l'avenir fais les changements directement »), il ne veut
plus de câble ni de téléchargement manuel.

**How to apply:** le script incrémente seul le correctif si la version est déjà publiée. Ne pas publier
un build cassé ni un changement non vérifié ; signaler dans le rapport la version publiée.
