# CIKA · Canal diaspora Europe : simulateur des options

Page de travail qui présente et chiffre les trois options de réalisation du canal diaspora proposé par LPF (développement endogène EME, marque blanche BaaS + SGP, distribution sans wallet), avec la variante « option 3 + PSFP propre ».

Quatre onglets :

- **Les options** : texte de la note d'analyse ; chaque chiffre cité est lu dans le modèle pour le scénario courant.
- **Simulateur** : hypothèses modifiables, indicateurs, courbe de trésorerie cumulée, détail annuel, lecture automatique, sensibilité au montant investi.
- **Fiche** : synthèse d'une page du scénario courant ; « Exporter en PDF » ouvre la fenêtre d'impression (A4, une page).
- **Hypothèses et méthode** : valeurs par défaut et valeurs courantes de chaque paramètre, cadre réglementaire, formules, chiffres de contrôle recalculés à l'ouverture.

## Ouvrir la page

En ligne : https://ananoufoly.github.io/cika-diaspora/ (page non indexée, sans lien depuis le reste du site). En local : ouvrir `index.html` dans un navigateur. Un seul fichier, sans dépendance externe ; la page fonctionne hors ligne. Les hypothèses saisies sont mémorisées dans le navigateur (`localStorage`) ; le bouton « Réinitialiser » rétablit les valeurs par défaut.

## Modifier les hypothèses par défaut

Les valeurs par défaut sont dans l'objet `DEFAULTS`, en tête du script de `index.html` :

- `DEFAULTS.common` : paramètres communs (horizon de simulation, clients des années 1 à 5 puis croissance annuelle, montant investi, coût d'acquisition, commissions, etc.). Les pourcentages s'écrivent en fraction (`0.015` pour 1,5 %).
- `DEFAULTS.options` : un objet par option, dans l'ordre 1, 2, 3, 3 + PSFP (délai en mois, coûts en K€, année d'activation de la PSFP, marge des autres produits du wallet et leur année de lancement, etc.).

Après modification, l'onglet « Hypothèses et méthode » indique si les chiffres de contrôle (valeurs par défaut, horizon de 5 ans, sans autres produits du wallet) sont toujours retrouvés. Changer les valeurs par défaut fait apparaître des écarts attendus : mettre alors à jour l'objet `CONTROL`.
