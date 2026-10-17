# Simulateur des options : canal diaspora

Page de travail à accès restreint. Elle présente les options de réalisation étudiées, permet de les simuler en changeant les hypothèses et produit une fiche de synthèse d'une page, exportable en PDF.

Ce dossier ne contient que la version **chiffrée** de la page (`diaspora.enc`, AES-256-GCM, clé dérivée du mot de passe par PBKDF2-SHA256) et la page d'accès (`index.html`). Le contenu en clair n'est jamais publié.

## Ouvrir la page

Ouvrir `/cika-diaspora/` sur le site et saisir le mot de passe communiqué. Une fois déchiffrée, la page fonctionne sans connexion supplémentaire. Les hypothèses saisies sont mémorisées dans le navigateur ; le bouton « Réinitialiser » rétablit les valeurs par défaut.

## Modifier les hypothèses par défaut

1. Dans la source en clair (locale, hors dépôt : `cika-diaspora-src/index.html`), modifier l'objet `DEFAULTS` en tête du script :
   - `DEFAULTS.common` : hypothèses communes ; les pourcentages s'écrivent en fraction (`0.015` pour 1,5 %) ;
   - `DEFAULTS.options` : un objet par option, dans l'ordre d'affichage.
2. Vérifier dans l'onglet « Hypothèses et méthode » que les chiffres de contrôle sont toujours retrouvés ; s'ils ont changé volontairement, mettre à jour l'objet `CONTROL`.
3. Rechiffrer avec l'outil local : `python encrypt_diaspora.py` (le mot de passe est demandé, jamais stocké), puis committer `diaspora.enc`.

## Avertissement

Toutes les valeurs sont des hypothèses à remplacer par des devis et des tests de marché réels.
