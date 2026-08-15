# CLAUDE.md

Instructions permanentes pour ce dépôt. Lues à chaque session.

## Le projet

Roguelike de score en solo, basé sur la mécanique de semis du mancala (Awalé).
Le joueur distribue des Jetons le long d'un Circuit de 12 Nœuds ; chaque Nœud
traversé déclenche son effet ; le tour se termine par une Moisson en chaîne.

**La bible du projet est `CARNET-DE-CONCEPTION.md`.** Elle fait autorité sur tout
ce qui concerne le design. **Lis-la avant toute tâche non triviale.** Ce fichier-ci
ne contient que les règles de travail et les conventions de code.

**L'angle du jeu, à protéger dans chaque décision :**
> Balatro est une liste. Notre jeu est un circuit.
> Les Modules sont posés SUR le parcours, et le joueur choisit son point de départ,
> donc quel segment il traverse. La position d'un Module compte autant que son effet.

---

## Vocabulaire — OBLIGATOIRE

Le design et le code sont écrits en vocabulaire **neutre**, jamais thématique.
La direction artistique n'est pas décidée (carnet §10) et le vocabulaire ne doit
jamais l'anticiper. Pas de « graine », pas de « trou », pas de « planter ».

| Terme | Sens |
|---|---|
| **Nœud** (`Node`) | Une des 12 positions du Circuit |
| **Jeton** (`Token`) | L'unité qui circule |
| **Circuit** (`Circuit`) | La boucle orientée reliant les Nœuds |
| **Distribuer** (`sow`) | Vider un Nœud et déposer ses Jetons un par un |
| **Moisson** (`harvest`) | La capture en chaîne de fin de tour, résolue à rebours |
| **Charge** (`charge`) | Le multiplicateur accumulé pendant le trajet |
| **Zone Neutre** (`neutralZone`) | Territoire non joueur, seul endroit moissonnable |
| **Module** (`Module`) | L'amélioration posée sur un Nœud (notre « joker ») |
| **Outil** (`Tool`) | Modificateur global de règle |
| **Épreuve** (`Trial`) | Manche-boss, qui casse une règle |
| **Manche / Étape / Run** | `Round` / `Stage` / `Run` |

Identifiants et types en anglais, commentaires et messages en français.

---

## Architecture — règles non négociables

### 1. Séparation stricte cœur / présentation

Le moteur de règles (`src/core/`) est **pur** :
- aucun import de rendu, de son, d'entrée utilisateur, de DOM, d'horloge, de `Math.random` direct
- l'aléatoire passe par un PRNG seedé injecté dans l'état
- signature : `(state, move) -> { state, events }`
- doit être jouable en CLI sans une ligne de rendu

`events` est une liste **ordonnée** que la couche de présentation rejoue pour
animer et sonoriser. Le cœur ne sait pas qu'une animation existe.

Bénéfices : le choix du moteur graphique reste réversible, on peut équilibrer par
simulation en batch, et le code pur est testable.

### 2. Tout est donnée, rien n'est constante

Nombre de Nœuds, connectivité du Circuit, sens de rotation, seuil de capture,
règle d'arrêt de chaîne : **des paramètres de configuration**. Jamais de valeur
en dur. Toute la rejouabilité à long terme (carnet §9, axe 4 : plateaux 2×8, 4×8,
circuits à embranchements) en dépend.

Si tu écris `12`, `2`, `3` ou `6` dans le cœur, c'est un bug.

### 3. Les Modules sont des données

Un Module = un objet déclaratif + une fonction de déclenchement, dans son propre
fichier. **Ajouter un Module ne doit jamais modifier le cœur.** Aucun `switch` sur
l'identifiant d'un Module dans le moteur.

Objectif à terme : 150+ Modules, dont ~40 % sensibles à leur position.

### 4. Le cœur ne connaît pas le score final

Il émet les événements et les valeurs ; la formule `MOISSON × CHARGE` est
appliquée à un seul endroit, identifiable et modifiable.

---

## Règles de jeu à ne jamais casser

- **Seules les Moissons marquent.** Un tour sans capture rapporte zéro. C'est notre
  équivalent natif de la distinction main/défausse de Balatro. Ne jamais diluer.
- **Capture :** dernière Jeton déposé + Nœud en Zone Neutre + total exactement 2 ou 3.
- **Chaîne :** après capture, on remonte le Circuit à rebours tant que les Nœuds sont
  en Zone Neutre et dans la fenêtre de capture.
- **Pas d'IA adverse.** La rangée d'en face est la Zone Neutre, un territoire, pas un joueur.
- **Deux réservoirs multiplicatifs.** Jamais de score purement additif.
- Détail complet et exemples chiffrés : carnet §3 et §5.
  L'exemple de chaîne du **§3.4 est l'oracle de référence** — il doit exister en test.

---

## Anti-objectifs

- Pas de thème agricole (graines, terre, plantation) ni de casino/néon
- Pas de Module qui fait seulement « +X » : casser une règle, dépendre du contexte,
  ou interagir avec les autres
- Pas de tutoriel textuel — le premier coup doit s'auto-expliquer
- Pas de contenu verrouillé derrière des heures de méta-progression
- Pas de multijoueur, jamais
- Pas d'animation non passable
- Pas de « on verra plus tard pour le feel » — le feel est le premier jalon

---

## Points de vigilance permanents

- **Déterminisme (risque n°1).** L'Awalé est à information parfaite. Sans hasard, le
  jeu devient un puzzle, et un puzzle résolu ne se rejoue pas. Mais trop de hasard tue
  la planification, qui est justement ce qui rend le mancala satisfaisant. Curseur à
  ajuster en playtest, pas sur le papier. Signale-moi toute décision qui le déplace.
- **Boucles infinies.** Le Module « Rejouer » et les Modules de topologie peuvent
  boucler. Plafond dur systématique, et avance rapide dès le premier prototype.
- **Lisibilité.** L'état du plateau doit se lire en UNE SECONDE. 12 Nœuds × (compteur
  + Module + icône) sature très vite. Hiérarchie : le nombre de Jetons d'abord.
- **Scope.** Développeur solo débutant en graphisme. Toujours proposer le plus petit
  incrément testable.

---

## Le moment de comptage — priorité absolue

C'est 80 % du plaisir du jeu. Un design parfait avec un comptage tiède est un échec.

- Un son percussif **par Jeton déposé**, tempo régulier, qui s'accélère avec la Charge
- Le Jeton est un objet qu'on suit des yeux, jamais un chiffre qui change
- La chaîne de Moisson se résout **maillon par maillon, à rebours**, avec une note qui
  monte d'un demi-ton à chaque maillon et un silence marqué quand elle casse
- Le comptage d'une main de poker est une addition ; notre chaîne est un **suspense**.
  C'est notre atout n°1, il doit être servi par le code d'animation.

---

## Stack

- TypeScript + Vite, rendu Canvas 2D, zéro dépendance de jeu
- Vitest pour les tests
- Le moteur graphique définitif n'est pas décidé (carnet §15.4) — d'où la règle 1
- Placeholders graphiques assumés jusqu'au jalon 2

---

## Manière de travailler

- **Propose l'architecture avant de coder** sur toute tâche non triviale. Types,
  arborescence, découpage. J'valide, puis tu codes.
- **Le plus petit incrément testable**, toujours. Pas de gros blocs.
- **Tests sur le cœur systématiques.** Tout changement de règle vient avec son test.
- **Signale les ambiguïtés du carnet** au lieu de trancher seul. Le design est en
  cours, tes questions le font avancer.
- **Ne dépasse pas le périmètre du jalon en cours.** Si une idée dépasse, note-la,
  ne l'implémente pas.
- Si une décision contredit le carnet, dis-le explicitement avant de l'appliquer.

---

## Jalon en cours : JALON 0 — prototype de feel

Périmètre : plateau 2×6, distribution, capture en chaîne, 3 Modules (+1 Charge,
×2 Charge, Rejouer), une manche à quota en 15 tours, le son des clacs, la chaîne
à rebours.

Hors périmètre : boutique, économie, étapes, Épreuves, types de Jetons, méta,
menu, art, thème.

**Critère de réussite, unique :** est-ce que j'ai envie de relancer une manche ?

Détail complet : carnet §14.
