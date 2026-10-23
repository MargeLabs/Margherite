# Lessons — Margherite

> Erreurs passées et règles apprises. Relire au début de chaque session.

## 2026-10-23 — Tests Playwright
**Erreur :** une assertion sur `innerText` d'un `<h2>` échouait : `innerText` applique `text-transform: uppercase` (« NOUVEAU TIRAGE » ≠ « Nouveau tirage »).
**Règle :** comparer du texte avec `textContent` dès que le CSS transforme la casse ; réserver `innerText` à ce que l'utilisatrice voit.

<!-- Format :
## [YYYY-MM-DD] — [contexte]
**Erreur :** ce qui s'est passé
**Règle :** ce qu'il faut faire à la place
-->
