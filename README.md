# Awoo *(nom de code)*

**Un roguelike de score en solo où l'on ne fait pas évoluer ses ressources, mais le circuit qu'elles parcourent.**

Douze Nœuds en anneau. Des Jetons qui circulent. Chaque tour, vous en choisissez un,
vous le videz, et vous distribuez son contenu un par un le long du Circuit. Tout ce
que les Jetons traversent se déclenche. Et à l'arrivée, si vous avez visé juste, une
réaction en chaîne remonte le parcours à l'envers et rafle tout.

> **Balatro est une liste. Notre jeu est un circuit.**

Dans Balatro, les jokers sont alignés dans une barre : ils se déclenchent tous, dans
l'ordre, à chaque main. Ici, vous **choisissez votre point de départ**, donc **quel
segment du Circuit vous traversez**, donc **quels objets se déclenchent et dans quel
ordre**. La position d'une amélioration compte autant que son effet.

C'est l'angle du jeu. Tout le reste en découle.

---

## Un tour, en quatre temps

**1. Vous réfléchissez vingt secondes.** L'état du plateau est entièrement visible :
pas de main cachée, pas de pioche, pas d'adversaire qui joue après vous. Le coup
parfait est là, quelque part.

**2. Vous cliquez une fois.** Les Jetons partent, un par un, avec un clac par Jeton
déposé. Chaque Nœud traversé s'allume et fait son effet. Le tempo s'accélère à mesure
que la **Charge** — votre multiplicateur — grimpe.

**3. Le dernier Jeton se pose.** S'il atterrit en **Zone Neutre** sur un Nœud qui
contient alors exactement 2 ou 3 Jetons, c'est une **Moisson**. Sinon, le tour n'a
rien rapporté — et ce n'est pas un échec, c'était un coup de préparation.

**4. La chaîne se résout à rebours.** On remonte le Circuit à l'envers : le Nœud
précédent, puis le précédent, puis le précédent, tant qu'ils restent capturables.
Chaque maillon monte d'un demi-ton. Le silence, quand la chaîne casse, fait mal.

```
AVANT                                     RÉSOLUTION (à rebours)
      f    e    d    c    b    a                d = 3  ✓
      0    1    2    1    1    2                c = 2  ✓
      3    0    2    0    1   [4]               b = 2  ✓
      A    B    C    D    E    F                a = 3  ✓
                              ↑ on vide         F     → hors Zone Neutre, la chaîne casse

DÉPÔT : a 2→3, b 1→2, c 1→2, d 2→3 ← dernier Jeton         MOISSON : 10 Jetons
```

Un seul coup rafle 10 Jetons sur 48 et rase la moitié d'une rangée. **C'est ce moment,
et lui seul, qui doit devenir notre « je pose ma main ».**

### Le score

```
SCORE DU TOUR  =  MOISSON  ×  CHARGE
```

**Le voyage construit le multiplicateur. La destination détermine la base.** Deux
réservoirs distincts, attaquables séparément, qui se multiplient à la fin — c'est la
condition du vertige exponentiel, et le mancala la remplit nativement.

---

## Pourquoi ce jeu-là

Quatre choses font réellement marcher un roguelike de score. Le mancala les coche
toutes les quatre, sans qu'on ait rien à inventer.

**Deux variables qui se multiplient.** Moisson × Charge. Naturel, pas plaqué.

**Un moment de comptage.** Distribuer, c'est *déjà* une énumération, un Jeton à la
fois. Capturer, c'est *déjà* une chaîne. On n'a pas eu à fabriquer le suspense : il
est dans les règles depuis huit cents ans.

**Des règles cassables.** Sens de circulation, seuil de capture, longueur de chaîne,
territoire, contenu des Nœuds, topologie du plateau : six surfaces au moins, chacune
attaquable par des dizaines d'améliorations. Il y a de quoi casser le jeu à cent
cinquante endroits différents.

**Zéro friction d'apprentissage.** « On prend les jetons d'une case et on les
distribue dans les suivantes. » Une phrase. Pas de tutoriel, pas d'écran de règles.

### Et deux choses en plus

**La distinction armer / tirer est native.** Balatro a dû inventer le système
main/défausse pour créer des coups qui ne marquent pas. Le mancala l'a d'origine :
la moitié des coups servent à **armer** le plateau — approvisionner un Nœud, amener
une cible dans la fenêtre de capture, aligner la chaîne — et un coup sur quatre ou
cinq **tire**. Chez nous, **seules les Moissons marquent**. Règle non négociable.

**La chaîne est un suspense, pas une addition.** Le comptage d'une main de poker
énumère un total connu d'avance. Notre chaîne, personne ne sait où elle s'arrête —
pas même vous, au moment où vous cliquez. Chaque maillon est une petite victoire.
Aucun jeu de cartes ne peut faire ça.

---

## Le solo sans adversaire

Il n'y a pas d'IA en face. Jamais. La rangée d'en face est la **Zone Neutre** : un
territoire, pas un joueur. C'est le seul endroit où vous pouvez moissonner.

Et c'est là que les règles offrent la plus belle tension du jeu : pour atteindre les
Nœuds lointains, vous êtes **obligé** de distribuer dans la Zone Neutre. Chaque coup
de préparation **donne** des Jetons au territoire que vous convoitez.

> **On nourrit sa propre cible.**

La Zone Neutre a en plus son propre comportement, tiré au sort en début de partie :
fertile (elle régénère), aspirante (elle attire), corrosive (elle détruit), réactive
(elle vous renvoie tout), cristallisante (elle se ferme si vous tardez). La texture
d'une run change complètement selon ce qui vous tombe dessus.

---

## Les Modules : la position est le puzzle

Un **Module** est une amélioration posée **sur un Nœud** — notre équivalent du joker.
Douze emplacements, tous visibles en permanence. Cinq familles :

| Famille | Se déclenche | Exemples |
|---|---|---|
| **Passage** | quand un Jeton traverse | +1 Charge par Jeton ; le troisième Jeton du tour est dupliqué |
| **Destination** | quand le dernier Jeton s'arrête ici | rejouer immédiatement ; le Nœud est doublé |
| **Moisson** | modifie la règle de capture | capture aussi sur 4 ; les chaînes ne s'arrêtent plus en sortant de la Zone Neutre |
| **Topologie** | modifie le Circuit lui-même | inverse le sens ; téléporte trois Nœuds plus loin ; ouvre un raccourci |
| **Structure** | interagit avec les autres Modules | **double la Charge accumulée jusqu'ici** ; copie l'effet du Nœud précédent |

Prenez le dernier, « double la Charge accumulée ».

- Posé **après** trois Modules « +1 Charge », il double une grosse Charge. Excellent.
- Posé **avant**, il double presque rien. Inutile.

Même Module, même prix, même run. **La position seule fait la différence entre une
pièce maîtresse et un emplacement gâché** — et l'ordre change à chaque partie, parce
que la boutique propose ce qu'elle veut, quand elle veut. Aucune amélioration ne se
contente de faire « +X » : chacune doit casser une règle, dépendre du contexte, ou
interagir avec les autres.

---

## Une run

Une run, c'est **8 étapes de 3 manches** : une petite, une grande, une **Épreuve**.
Chaque manche est un quota de points à atteindre en un nombre de tours limité. Entre
les manches, la boutique : Modules, Jetons, Outils.

Les Épreuves ne gonflent pas un quota, elles **cassent une règle** : le Circuit tourne
à l'envers, les chaînes s'arrêtent à deux maillons, la Charge est remise à zéro à
chaque Nœud traversé, trois de vos Nœuds sont scellés, aucune Moisson pendant les
trois premiers tours. À chaque fois, votre build doit se réinventer.

Et il y a un cadeau structurel dans les règles : **les Jetons moissonnés quittent
définitivement le jeu.** Le plateau se vide au fil de la manche, l'espace se referme
tout seul, la tension monte mécaniquement. Les derniers tours sont les plus tendus
sans qu'on ait eu à scripter quoi que ce soit.

---

## Où en est le projet

Le cœur du jeu est écrit, testé, et jouable — au clavier comme en ligne de commande.

**Fait**
- Le moteur de règles complet : distribution, capture en chaîne à rebours, Charge,
  formule de score, coups légaux, fin de manche
- Le prototype de feel : clacs à tempo, chaîne maillon par maillon, avance rapide
- Trois Modules (`+1 Charge`, `×2 Charge`, `Rejouer`) et une manche à quota
- La boucle de run : économie, boutique seedée, étapes enchaînées, mode infini
- Des géométries de plateau alternatives (« avant-poste » : une case joueur posée
  dans la rangée neutre, qui brise les grandes chaînes et ouvre une tête de pont)
- L'équilibrage par simulation : des milliers de manches jouées sans rendu pour
  calibrer les quotas sur des chiffres plutôt que sur une intuition

**Ensuite**
- **L'identité** — la direction artistique n'est pas choisie, et le vocabulaire du
  code reste volontairement neutre en attendant. Les pistes sérieuses partent toutes
  d'une coïncidence : douze positions, comme un cadran. Horlogerie, alchimie,
  mécanique céleste. Le jeu n'a pas encore de nom non plus.
- **Le contenu** — viser 150+ Modules, dont au moins 40 % sensibles à leur position.
  Des types de Jetons (lourd, jumeau, muet, vagabond, ancré). Des Outils qui changent
  une règle pour toute la run. Les huit étapes et toutes les Épreuves.
- **La profondeur** — la famille mancala contient déjà des plateaux 2×8, 4×8,
  circulaires, à trous doubles. On peut faire démarrer chaque run sur une géométrie
  différente : embranchements, boucles imbriquées, Circuits en huit. **Balatro joue
  toujours sur la même table ; nous pouvons changer le circuit.** Un joueur qui a
  « fini » le 2×6 découvre que le 4×8 est un autre jeu avec les mêmes Modules.

---

## Le moment de comptage

C'est 80 % du plaisir et 80 % du travail. Un design parfait avec un comptage tiède est
un échec ; un design moyen avec un comptage jouissif marche. Le cahier des charges
n'est donc pas négociable :

- **un son percussif par Jeton déposé**, tempo régulier, qui s'accélère avec la Charge ;
- le Jeton est **un objet qu'on suit des yeux**, jamais un chiffre qui change ;
- la chaîne se résout **maillon par maillon, à rebours**, une note plus haut à chaque
  maillon, un silence marqué quand elle casse ;
- le nombre final doit devenir **trop gros pour sa boîte**.

Et toute animation est passable. Toujours.

---

## Jouer / développer

```bash
npm install
npm run dev        # le jeu dans le navigateur
npm run cli        # une manche jouable au clavier, sans une ligne de rendu
npm run balance    # équilibrage par simulation
npm test           # les tests du cœur
npm run typecheck
```

En jeu : **clic** sur un Nœud pour le distribuer, **Espace** pour l'avance rapide,
**M** pour couper le son, **R** pour relancer une run.

Le rendu actuel est un placeholder assumé. Il sert à sentir le jeu, pas à le vendre.

---

## Comment le code est fait

Deux règles d'architecture, non négociables, qui expliquent presque toute
l'arborescence.

**1. Le cœur est pur.** `src/core/` ne connaît ni rendu, ni son, ni entrée, ni DOM, ni
horloge, ni `Math.random` — l'aléatoire passe par un PRNG seedé injecté dans l'état.
Signature unique : `(state, move) -> { state, events }`. Les `events` sont une liste
ordonnée (`TOKEN_DROPPED`, `MODULE_TRIGGERED`, `HARVEST_LINK`, `HARVEST_BROKEN`…) que
la couche de présentation rejoue pour animer et sonoriser. Le cœur ignore qu'une
animation existe. Trois bénéfices : le choix du moteur graphique reste réversible, on
peut équilibrer par simulation, et le code pur se teste. La commande `npm run cli` est
là pour le prouver en permanence : si un jour il faut du Canvas pour jouer un tour,
c'est que le cœur a été contaminé.

**2. Tout est donnée, rien n'est constante.** Nombre de Nœuds, connectivité du
Circuit, sens de rotation, seuil de capture, règle d'arrêt de chaîne, quotas : des
paramètres de configuration, rassemblés dans `src/presets/`. Aucune valeur en dur dans
le moteur. C'est ce qui rendra possible le 2×8 et le 4×8 sans réécrire le jeu.

Corollaire : **un Module est une donnée** — un objet déclaratif plus une fonction de
déclenchement, dans son propre fichier sous `src/modules/`. Ajouter un Module ne
modifie jamais le cœur, et le moteur ne fait aucun `switch` sur un identifiant.

```
src/core/      le moteur de règles, pur et testé
src/modules/   le catalogue des Modules (données)
src/presets/   tous les chiffres du jeu
src/app/       rendu Canvas, audio, timeline d'animation
src/sim/       CLI jouable et équilibrage par simulation
tests/         les tests du cœur — dont l'oracle de la chaîne de référence
```

Stack : TypeScript + Vite, Canvas 2D, Vitest. Zéro dépendance de jeu.

---

## Ce qu'on ne fera pas

Pas d'IA adverse. Pas de score purement additif. Pas de Module qui fait seulement
« +X ». Pas de tutoriel textuel — le premier coup doit s'auto-expliquer. Pas de
contenu verrouillé derrière des heures de méta-progression. Pas de thème agricole
(graines, terre, plantation) ni de casino et néons. Pas d'animation non passable.
Et pas de multijoueur, jamais.

---

## Documents du projet

- **[`CARNET-DE-CONCEPTION.md`](CARNET-DE-CONCEPTION.md)** — la bible. Fait autorité
  sur tout ce qui touche au design : règles détaillées, moteur de score, catalogue de
  Modules, structure de run, pistes de direction artistique, risques, roadmap.
- **[`CLAUDE.md`](CLAUDE.md)** — les règles de travail et les conventions de code.

Le vocabulaire est neutre partout, dans le design comme dans le code : Nœud, Jeton,
Circuit, Distribuer, Moisson, Charge, Zone Neutre, Module. Le jour où la direction
artistique sera choisie, le design ne bougera pas d'une ligne. Le code non plus.
