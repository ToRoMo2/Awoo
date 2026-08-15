# CARNET DE CONCEPTION — Projet [SANS NOM]

> Roguelike solo de score, basé sur la mécanique de semis du mancala.
> Document vivant. Dernière mise à jour : session 1.

---

## 0. Comment lire ce document

Ce carnet est organisé en **deux couches strictement séparées** :

- **La couche MÉCANIQUE** (§3 à §8) — les règles, le moteur de score, la boucle de jeu. Elle est écrite en vocabulaire **neutre et abstrait**. Elle est stable.
- **La couche THÉMATIQUE** (§10) — la direction artistique, les noms, l'univers. Elle est **ouverte et non décidée**.

**Règle absolue du projet : ne jamais écrire de mécanique en vocabulaire thématique.** On ne dit pas « la graine traverse la Fournaise », on dit « le Jeton traverse un Nœud de type Passage ». Le jour où on change de DA, le design ne bouge pas d'une ligne. Le code non plus (voir §15).

Le vocabulaire neutre officiel est en §17. Il fait foi partout.

---

## 1. Vision

### 1.1 Le pitch

Un roguelike de score en solo où l'on ne fait pas évoluer ses ressources, **mais le circuit qu'elles parcourent**.

Le joueur dispose d'un anneau de 12 Nœuds. À chaque tour il choisit un Nœud, en retire tous les Jetons, et les distribue un par un le long du circuit. Chaque Nœud traversé déclenche son effet. Le tour se termine par une **Moisson** : une réaction en chaîne qui remonte le parcours à l'envers et rafle tout ce qui est capturable.

Entre les manches, on achète des améliorations que l'on **pose sur le circuit**. La position compte autant que l'objet.

### 1.2 La phrase qui résume tout

> **Balatro est une liste. Notre jeu est un circuit.**

Dans Balatro, les jokers sont alignés dans une barre : ils se déclenchent tous, dans l'ordre, à chaque main. Chez nous, le joueur **choisit son point de départ**, donc **quel segment du circuit il traverse**, donc **quels objets se déclenchent et dans quel ordre**. C'est notre angle. C'est ce qui justifie l'existence du jeu. **Tout le design doit protéger cet angle.**

### 1.3 Le sentiment visé

Un tour, c'est : je réfléchis 20 secondes, je clique une fois, et je regarde ma machine se déclencher pendant 8 secondes en produisant un nombre trop gros pour la boîte.

---

## 2. Inspiration : ce qui fait réellement marcher Balatro

Analyse structurelle. C'est notre grille de validation : **toute idée de design doit pouvoir être justifiée par au moins un de ces quatre piliers.**

### Pilier 1 — Deux variables qui se MULTIPLIENT
Chips × Mult. Un score additif ne peut pas produire le vertige de l'exponentiel. Il faut deux réservoirs distincts, attaquables séparément, et qui se multiplient à la fin.

### Pilier 2 — Un moment de comptage
Balatro n'a pas inventé le poker. Il a inventé **le fait de regarder le poker se compter**. Le jeu s'arrête et énumère les déclenchements un par un, avec un son par déclenchement. C'est 80 % du plaisir et 80 % du travail.

### Pilier 3 — Des règles CASSABLES
Les jokers ne modifient pas des chiffres, ils **violent la règle fondamentale** (une quinte avec des trous, une couleur avec n'importe quelle carte). Le jeu de base doit donc avoir assez de *surface de règle* pour être cassé à 150 endroits différents.

### Pilier 4 — Zéro friction d'apprentissage
Tout le monde connaît une paire et un brelan. Aucun tutoriel n'est nécessaire pour comprendre l'objet de base.

### Pourquoi le mancala coche les quatre
1. **Moisson × Charge** — deux réservoirs naturels (§5).
2. Le semis est **déjà** une énumération, un Jeton à la fois. La chaîne de capture est **déjà** un suspense.
3. Surface de règle énorme : sens de circulation, seuil de capture, longueur de chaîne, territoire, contenu des Nœuds, topologie. Six axes cassables au moins.
4. « Prendre les cailloux d'un trou et les distribuer dans les suivants » se comprend en une phrase et sans texte.

### Le point que le mancala a EN PLUS
Le mancala a nativement une distinction **coup de préparation / coup de tir** (voir §5.3). Balatro a dû l'inventer avec le système main/défausse. Nous l'avons gratuitement, dans les règles d'origine. C'est notre meilleur argument pour ce jeu-là plutôt qu'un autre.

---

## 3. Le jeu source — règles de référence

> Note de vocabulaire : « Mancala » n'est pas un jeu, c'est une **famille** de plusieurs centaines de jeux. On s'appuie sur deux membres : **l'Awalé** (Afrique de l'Ouest, le moteur profond) et le **Kalah** (version commerciale des années 1950, dont on vole deux règles).

### 3.1 Le plateau (Awalé)

12 trous, 2 rangées de 6. Chaque joueur possède la rangée devant lui. 4 graines par trou au départ, **48 graines au total**.

```
        ←──────── sens de circulation ────────
      ┌────┬────┬────┬────┬────┬────┐
NORD  │ f  │ e  │ d  │ c  │ b  │ a  │
      │ 4  │ 4  │ 4  │ 4  │ 4  │ 4  │
      ├────┼────┼────┼────┼────┼────┤
SUD   │ A  │ B  │ C  │ D  │ E  │ F  │
      │ 4  │ 4  │ 4  │ 4  │ 4  │ 4  │
      └────┴────┴────┴────┴────┴────┘
        ────────  sens de circulation ────────→
```

Le circuit est **UNE SEULE BOUCLE** de 12 cases, sens antihoraire :

```
A → B → C → D → E → F → a → b → c → d → e → f → A → ...
```

**C'est la clé de tout.** Il n'y a pas « mon côté » et « son côté » du point de vue du mouvement. Il y a un anneau. La propriété des trous ne sert qu'à déterminer **où l'on a le droit de commencer** et **où l'on a le droit de capturer**.

### 3.2 Le semis

1. Choisir un de ses trous, non vide.
2. En prendre **toutes** les graines. Le trou d'origine devient vide.
3. Les distribuer **une par une** dans les trous suivants, dans le sens de la boucle, y compris chez l'adversaire.

Exemple, le Sud joue **D** (4 graines) :

```
AVANT
      f    e    d    c    b    a
      4    4    4    4    4    4
      4    4    4   [4]   4    4
      A    B    C    D    E    F
                     ↑ on vide

Les 4 graines partent vers E, F, a, b

APRÈS
      f    e    d    c    b    a
      4    4    4    4    5    5
      4    4    4    0    5    5
      A    B    C    D    E    F
```

**Cas particulier :** si l'on ramasse 12 graines ou plus, on fait plus d'un tour complet — dans ce cas on **saute le trou d'origine**, qui reste vide.

### 3.3 La capture

> **Si la dernière graine tombe dans un trou ADVERSE, et que ce trou contient alors exactement 2 ou 3 graines, on les capture.**

Trois conditions cumulatives : **dernière** graine + territoire **adverse** + total de **2 ou 3**.

Logique à retenir : on capture un trou **qu'on vient de remplir**. On ne capture pas ce qui est gros, on capture **ce qui est maigre**.

### 3.4 La capture en chaîne — LE MÉCANISME CENTRAL

Après une capture, on **remonte le circuit à l'envers**. Le trou précédent : s'il est encore en territoire adverse et contient 2 ou 3 graines, il est capturé aussi. Puis le précédent. Jusqu'à ce que la chaîne casse (trou hors seuil) ou qu'on sorte du territoire adverse.

Exemple. Le Sud joue **F** (4 graines) :

```
AVANT
      f    e    d    c    b    a
      0    1    2    1    1    2
      3    0    2    0    1   [4]
      A    B    C    D    E    F

DÉPÔT
      a : 2 → 3
      b : 1 → 2
      c : 1 → 2
      d : 2 → 3   ← dernière graine

RÉSOLUTION (on remonte à l'envers)
      d = 3  ✓ capturé
      c = 2  ✓ capturé
      b = 2  ✓ capturé
      a = 3  ✓ capturé
      F     = territoire propre → la chaîne s'arrête

APRÈS
      f    e    d    c    b    a
      0    1    0    0    0    0
      3    0    2    0    1    0
      A    B    C    D    E    F      RÉCOLTE : 10 graines
```

Un seul coup rafle 10 graines sur 48 et rase la moitié d'une rangée.
**C'est ce moment, et lui seul, qui doit devenir notre « je pose ma main ».**

### 3.5 Règles de fin (Awalé)

- **Règle de nourriture** — interdit d'affamer l'adversaire. Si sa rangée est vide, on est *obligé* de jouer un coup qui lui redonne des graines. Si impossible, la partie s'arrête et on ramasse tout.
- **Victoire** — 48 graines, donc le premier à **25** a la majorité.
- **Grand chelem** — un coup qui capturerait toutes les graines adverses d'un coup est souvent interdit ou ne rapporte rien. Garde-fou anti-blocage.

### 3.6 Le Kalah — les deux règles à voler

Le Kalah ajoute deux **greniers** aux extrémités (on sème dans le sien, jamais dans celui de l'adversaire).

1. **Si la dernière graine tombe dans son propre grenier → on rejoue immédiatement.**
2. **Si la dernière graine tombe dans un trou VIDE de son côté → on capture cette graine + tout le trou d'en face.**

**Décision retenue :** on garde **la capture en chaîne de l'Awalé** (§3.4) comme moteur de gros coup, et on greffe **la règle 1 du Kalah** (rejouer) comme moteur d'enchaînement. La règle 1 est un générateur de combo prêt à l'emploi. La règle 2 est une récompense pour la précision, à garder sous le coude comme effet d'objet.

---

## 4. Couche mécanique abstraite

Traduction officielle. **À utiliser partout, dans le design comme dans le code.**

| Concept source | Terme neutre du projet | Définition |
|---|---|---|
| Trou | **Nœud** | Une des 12 positions du Circuit. Contient des Jetons. Peut porter une amélioration. |
| Graine | **Jeton** | L'unité qui circule. Peut avoir un type et une valeur propres. |
| Le plateau | **Circuit** | La boucle orientée reliant les Nœuds. |
| Semer | **Distribuer** | Vider un Nœud et déposer ses Jetons un par un le long du Circuit. |
| Capture | **Moisson** | La résolution de fin de tour, en chaîne, à rebours. |
| Rangée adverse | **Zone Neutre** | Le seul territoire où l'on peut moissonner. |
| Amélioration de trou | **Module** | L'objet posé sur un Nœud (l'équivalent d'un joker). |

Les termes **Nœud, Jeton, Circuit, Distribuer, Moisson, Zone Neutre, Module, Charge** sont définitifs au niveau mécanique. Leurs noms visibles à l'écran changeront avec la DA.

---

## 5. Le moteur de score

### 5.1 La formule

```
SCORE DU TOUR  =  MOISSON  ×  CHARGE
```

- **MOISSON** — ce qui est ramassé au moment de la capture : nombre de Jetons × leur valeur individuelle.
- **CHARGE** — le multiplicateur accumulé **pendant le trajet**, en traversant les Nœuds améliorés.

> **Le voyage construit le multiplicateur. La destination détermine la base.**

Les deux moitiés du problème sont séparées et attaquables indépendamment — exactement le rôle de chips et mult. Un long trajet à travers un Circuit bien monté charge une Charge énorme ; encore faut-il qu'il se termine sur une chaîne de Moisson juteuse.

### 5.2 Conséquence de design

Ce découpage crée automatiquement **deux familles de build** :
- **Build Charge** — allonger et enrichir les trajets, empiler les multiplicateurs, enchaîner les tours.
- **Build Moisson** — casser les règles de capture, allonger les chaînes, augmenter la valeur unitaire des Jetons.

Et une troisième, la plus intéressante : **build de tempo**, qui vise à rejouer plusieurs fois dans le même tour.

### 5.3 SEULES LES MOISSONS MARQUENT

**Règle fondamentale, non négociable.** Un tour sans capture rapporte zéro point.

Conséquence : la moitié des coups servent à **armer** le plateau (approvisionner un Nœud, amener une cible dans la fenêtre de capture, aligner la chaîne) et un coup sur quatre ou cinq **tire**.

C'est notre distinction main/défausse, et elle est native. **Ne jamais la diluer.**

---

## 6. Les Modules — notre collection

12 emplacements, tous visibles en permanence. Cinq familles.

### 6.1 Modules de PASSAGE
*Se déclenchent quand un Jeton traverse le Nœud.*
- +1 Charge par Jeton qui passe
- Les Jetons qui traversent gagnent +3 de valeur permanente
- Chaque Jeton qui passe rapporte 1 pièce
- Le troisième Jeton à passer dans le tour est dupliqué

### 6.2 Modules de DESTINATION
*Se déclenchent quand le dernier Jeton s'y arrête.*
- **Rejouer immédiatement** (la règle Kalah, transformée en objet)
- Le contenu du Nœud est doublé
- Le contenu est copié dans le Nœud opposé
- Le Nœud est verrouillé jusqu'au prochain tour, et sa valeur double

### 6.3 Modules de MOISSON
*Modifient la règle fondamentale de capture.*
- La capture fonctionne aussi sur 4
- Les chaînes ne s'arrêtent plus en sortant de la Zone Neutre
- Capture aussi les Nœuds à 1 Jeton, pour la moitié de leur valeur
- Chaque maillon de chaîne au-delà du troisième donne +1 Charge

### 6.4 Modules de TOPOLOGIE
*Modifient le Circuit lui-même. La famille la plus puissante — à doser.*
- Inverse le sens de distribution pour le reste du tour
- Les Jetons qui arrivent ici sont téléportés trois Nœuds plus loin
- Ce Nœud est relié à un Nœud non adjacent (raccourci)
- Si ce Nœud est vide en fin de tour, il régénère 2 Jetons

### 6.5 Modules de STRUCTURE
*La vraie profondeur — ils interagissent avec les autres Modules.*
- **Double la Charge accumulée jusqu'ici** ← pierre angulaire, voir ci-dessous
- N'est jamais vidé par une distribution normale ; à 12 Jetons, explose et distribue dans les deux sens
- Copie l'effet du Nœud précédent
- Se déclenche une seconde fois si le tour précédent n'a rien moissonné

### 6.6 POURQUOI LA POSITION EST LE CŒUR

Prenons le Module « double la Charge accumulée ».

- S'il est **après** trois Modules « +1 Charge » → il double une grosse Charge. Excellent.
- S'il est **avant** → il double presque rien. Inutile.

**La position d'un Module sur le Circuit est un puzzle en soi**, et elle change à chaque run parce que les Modules s'achètent dans l'ordre où la boutique les propose, et que les emplacements se libèrent progressivement.

**Balatro n'a pas ça.** C'est notre valeur ajoutée mécanique. Il faut donc :
- que **beaucoup** de Modules soient sensibles à l'ordre (viser au moins 40 % du catalogue) ;
- que **déplacer** un Module soit possible mais coûteux (ressource dédiée, ou coût croissant) ;
- que l'interface rende l'ordre **immédiatement lisible** (le trajet doit se pré-visualiser au survol).

---

## 7. Le mode solo : la Zone Neutre

**Pas d'IA adverse. Jamais.** La rangée d'en face devient la **Zone Neutre** : un territoire non joueur, et le **seul endroit où l'on peut moissonner**.

### 7.1 La tension centrale, offerte par les règles

Pour atteindre les Nœuds lointains, on est **obligé** de distribuer dans la Zone Neutre. Chaque coup de préparation **donne** des Jetons au territoire que l'on convoite.

> **On nourrit sa propre cible.**

C'est la règle de nourriture de l'Awalé (§3.5) transformée en dilemme économique. C'est bien plus élégant qu'un adversaire scripté, et ça vient gratuitement des règles d'origine.

### 7.2 Comportements de la Zone Neutre

Tirés au sort en début de run, ils changent complètement la texture d'une partie :
- **Fertile** — régénère 1 Jeton par tour dans un Nœud aléatoire
- **Aspirante** — attire un Jeton depuis le Nœud adjacent chaque tour
- **Corrosive** — détruit 1 Jeton sur 4 qui y séjourne
- **Réactive** — tous les 3 tours, renvoie ses Jetons vers le camp du joueur
- **Cristallisante** — un Nœud non moissonné pendant 3 tours devient inmoissonnable

---

## 8. Structure de run

### 8.1 Architecture

- Une run = **8 étapes**, chacune contenant **3 manches** : petite, grande, **Épreuve** (le boss).
- Chaque manche : un **quota de points** à atteindre en un **nombre de tours limité**.
- Entre les manches : **boutique** (Modules, Jetons, Outils).

### 8.2 L'épuisement du plateau — notre fin de manche naturelle

Les Jetons moissonnés **quittent définitivement le jeu**. Le plateau se vide au fil de la manche.

Conséquence : **l'espace se referme tout seul**, la tension monte mécaniquement, et les derniers tours sont les plus tendus sans qu'on ait rien à scripter. Entre les manches, on **réensemence**.

C'est un cadeau structurel. À exploiter, pas à corriger.

### 8.3 Les Épreuves (boss)

**Elles cassent une RÈGLE, pas un score.** (Pilier 3.)
- Les Nœuds contenant 1 Jeton ne peuvent plus être joués
- 1 Jeton sur 4 disparaît en cours de distribution
- Le Circuit tourne dans l'autre sens
- Les chaînes de Moisson s'arrêtent à 2 maillons
- 3 Nœuds du camp joueur sont scellés pour la manche
- La Charge est remise à zéro à chaque Nœud traversé (build Moisson obligatoire)
- Aucune Moisson possible pendant les 3 premiers tours

---

## 9. Les 4 axes de rejouabilité

Par ordre d'importance décroissante pour le développement, mais **croissante pour la durée de vie**.

### Axe 1 — Les Modules
La collection principale. Cible : **150+**, dont 40 % sensibles à la position.

### Axe 2 — Les Jetons
L'équivalent des cartes améliorées. Types :
- **Lourd** — compte double au dépôt
- **Jumeau** — se scinde en deux à mi-parcours
- **Muet** — ne déclenche aucun Module mais vaut 5
- **Vagabond** — fait toujours le tour complet quoi qu'il arrive
- **Ancré** — ne quitte jamais son Nœud

### Axe 3 — Les Outils (modificateurs globaux)
Sens inversé en permanence, seuil de capture à 3-ou-4, distribution en sautant un Nœud sur deux, deux Jetons déposés par case…

### Axe 4 — LA TOPOLOGIE DU PLATEAU ⭐
**Le meilleur axe, et il est historiquement authentique.**

La famille mancala contient déjà des plateaux **2×8** (Congkak), **4×8** (Bao, Omweso), circulaires, à trous doubles. On peut faire démarrer chaque run sur une géométrie différente : embranchements, boucles imbriquées, troisième rangée déblocable, Circuits en huit.

**Balatro joue toujours sur la même table. Nous pouvons changer le circuit.**

C'est cet axe qui donne les centaines d'heures : un joueur qui a « fini » le 2×6 découvre que le 4×8 est un jeu différent avec les mêmes Modules. **À garder en tête dès l'architecture du code** (§15.3) : le nombre et la connectivité des Nœuds doivent être des données, jamais des constantes.

---

## 10. Direction artistique — DÉCISION OUVERTE

> ⚠️ **RIEN N'EST DÉCIDÉ ICI.** Cette section liste des pistes et des critères. Le vocabulaire mécanique (§4) reste neutre tant qu'un choix n'est pas arrêté.

### 10.1 Ce qu'on refuse

- ❌ **L'agriculture, les graines, la terre, la plantation.** Vient du jeu source, pas du nôtre. Pas assez désirable, pas assez identitaire.
- ❌ **Le casino, les néons, le feutre vert.** C'est Balatro. On sera comparés et on perdra.
- ❌ **L'exotisme décoratif** (masques, motifs « africains » plaqués). Le mancala est notre source mécanique, pas notre thème. Le prendre comme habillage serait à la fois paresseux et douteux.
- ❌ **L'usine / le convoyeur SF froid.** Fonctionne mécaniquement mais c'est visuellement froid, très occupé, et ça ressemble à un Factorio-lite.

### 10.2 Les critères d'un bon thème pour CE jeu

Un thème est bon s'il justifie naturellement les cinq éléments suivants. Grille à appliquer à toute nouvelle idée :

1. **Un circuit fermé** de 12 positions
2. **Un objet qui voyage** le long de ce circuit, un par un
3. **Une accumulation** pendant le trajet (la Charge)
4. **Une récolte violente** à l'arrivée, en cascade (la Moisson)
5. **Un son de rythme régulier** — un « clac » par unité déposée

### 10.3 La coïncidence à exploiter

**Le plateau a 12 positions.** Douze heures d'un cadran. Douze maisons du zodiaque. Douze mois. Douze apôtres. Douze coups de minuit.

Le Circuit **veut** être un cadran. Les meilleures pistes ci-dessous partent toutes de là.

### 10.4 Pistes

**A. ALCHIMIE / GRAND ŒUVRE** *(médiéval-ésotérique)* ⭐
Le Circuit est un athanor circulaire à 12 creusets. Les Jetons sont des gouttes de mercure ou d'essence qui circulent dans un réseau de verre et de laiton. Les Modules sont des appareils : alambic, creuset, four, prisme. La Moisson est une **distillation**. La Charge est la **pureté**. La structure de run suit le Grand Œuvre (nigredo → albedo → rubedo).
*Forces* — Matériaux chauds (laiton, verre, cuivre, bougie), très tactile. Les cascades justifient des changements de couleur du liquide, ce qui donne un feedback visuel énorme. Vocabulaire riche et immédiatement évocateur. Loin de Balatro.
*Risques* — L'alchimie est un thème un peu vu. Il faudra une patte visuelle forte pour ne pas ressembler à un jeu de potions générique.

**B. HORLOGERIE / MÉCANISME** ⭐
Le Circuit est littéralement un mouvement d'horloge à 12 positions. Les Jetons sont des billes de rubis. Les Modules sont des rouages, échappements, ressorts. La Moisson est une **sonnerie**. Les Épreuves sont des dérèglements.
*Forces* — Le tempo est **dans le thème**. Un clac par bille est un tic-tac, la chaîne de Moisson est un carillon qui monte. La lisibilité est excellente (le laiton sur fond sombre, formes géométriques nettes). Identité très forte et rare.
*Risques* — Peut devenir froid ou austère. Le mécanisme d'horlogerie est peu « chaleureux » et le pixel art métallique demande du métier.

**C. ASTROLOGIE / MÉCANIQUE CÉLESTE**
Le Circuit est un zodiaque à 12 maisons. Les Jetons sont des étoiles ou de la lumière. Les Modules sont des constellations et des instruments (astrolabe, sphère armillaire). La Moisson est une **conjonction**.
*Forces* — 12 maisons = correspondance parfaite. Palette bleu nuit / or, très vendeuse en capsule Steam. Sujet mystique, populaire, jamais fait en roguelike de score.
*Risques* — La lumière et le vide se lisent mal quand le plateau est chargé. Attention à la surcharge visuelle.

**D. NÉCROMANCIE / OSSUAIRE**
Le Circuit est une crypte à 12 niches. Les Jetons sont des âmes. La Moisson est une **récolte d'âmes** en cascade.
*Forces* — Très mémorable, ton affirmé, public roguelike acquis d'avance.
*Risques* — Saturé. Beaucoup de roguelikes gothiques sur le marché.

**E. RÉSEAU HYDRAULIQUE / ÉCLUSES**
Le Circuit est un canal à 12 bassins. Les Jetons sont de l'eau. Les Modules sont des écluses, moulins, turbines.
*Forces* — La circulation et la cascade sont **littérales**, donc la lecture est instantanée. Palette apaisante, originale.
*Risques* — Peut manquer d'enjeu et de « punch ». Difficile de rendre une cascade d'eau *violente*.

### 10.5 Recommandation provisoire

**Un croisement A + B ou B + C** : un appareil de laiton, mi-horloge mi-athanor, dans une pièce éclairée à la bougie. On récupère le tempo et la lisibilité de l'horlogerie, la chaleur et la richesse de l'alchimie, et éventuellement la carte postale céleste pour le marketing.

**Mais rien n'est décidé.** À trancher après le prototype v0 (§14), pas avant : on saura mieux ce qu'il faut donner à voir quand on aura senti le jeu.

### 10.6 Contraintes techniques de la DA

- **Pixel art**, comme Balatro — accessible pour un débutant en graphisme, et vieillit bien.
- **Contrainte absolue de lisibilité : l'état du plateau doit se lire en UNE SECONDE.** 12 Nœuds, chacun avec un compteur, un Module, une icône, des Jetons typés. Le risque d'illisibilité est majeur (§13.3).
- Une **palette restreinte** (12-16 couleurs) aide à la fois la lisibilité et l'identité.
- Prévoir que la Charge et la Moisson aient chacune **une couleur dédiée**, constante partout dans le jeu.

---

## 11. Le moment de comptage — PRIORITÉ ABSOLUE

**C'est 80 % du travail et 80 % du plaisir.** Un jeu au design parfait avec un comptage tiède est un échec. Un jeu au design moyen avec un comptage jouissif marche.

### 11.1 Ce que le mancala nous offre gratuitement

**C'est déjà un jeu sonore.** Distribuer, c'est **un clac par Jeton déposé**. Tempo régulier, physique, satisfaisant, qui peut s'accélérer avec la Charge.

Et surtout : **la chaîne de Moisson se résout à l'envers.** Le dernier Nœud d'abord, puis le précédent, puis le précédent.

> Le comptage d'une main de poker est une **addition**.
> Notre chaîne est un **suspense**.

Le joueur ne sait pas encore où ça va s'arrêter. Chaque maillon est une petite victoire, le silence quand la chaîne casse est une petite défaite. **Aucun jeu de cartes ne peut faire ça.** C'est notre atout n°1 en game feel.

### 11.2 Cahier des charges du feedback

**Pendant la distribution**
- Un son percussif par Jeton déposé, tempo régulier
- Le Jeton est un **objet physique qu'on suit des yeux**, jamais un chiffre qui change
- Chaque Nœud traversé s'illumine, son nom apparaît une fraction de seconde, son effet flotte au-dessus
- Le tempo s'accélère quand la Charge monte

**Pendant la Moisson**
- Résolution **maillon par maillon, à rebours**
- Une note qui **monte d'un demi-ton à chaque maillon**
- Un temps de silence marqué quand la chaîne casse
- Le plateau tremble sur les gros déclenchements

**Le nombre final**
- Il doit devenir **trop gros pour sa boîte**

### 11.3 Le prototype de feel avant tout le reste

Le premier jalon (§14) ne contient ni boutique, ni méta, ni art. Il contient **le clac et la chaîne**. Si ça ne procure rien à ce stade, aucune quantité de Modules ne le sauvera.

---

## 12. Ce qu'on ne veut PAS

- ❌ **Pas d'IA adverse.** Le solo est la Zone Neutre, pas un bot.
- ❌ **Pas de score additif seul.** Toujours deux réservoirs multiplicatifs.
- ❌ **Pas de Modules qui ne font que « +X ».** Chaque Module doit soit casser une règle, soit dépendre du contexte, soit interagir avec les autres.
- ❌ **Pas de tutoriel textuel.** Le premier coup doit s'auto-expliquer.
- ❌ **Pas de progression méta obligatoire** qui bride la première run (pas de contenu verrouillé derrière 10 heures).
- ❌ **Pas de multijoueur.** Jamais. Ce n'est pas le projet.
- ❌ **Pas de thème agricole** (§10.1).
- ❌ **Pas de cascade non passable.** Toute animation doit être accélérable.
- ❌ **Pas de « on verra plus tard pour le feel ».** Le feel est le premier jalon.

---

## 13. Risques et points d'attention

### 13.1 ⚠️ LE DÉTERMINISME — risque n°1

**L'Awalé est à information parfaite, sans hasard.** Notre jeu risque donc de ressembler à un **puzzle** plutôt qu'à un pari. Or un puzzle résolu ne se rejoue pas.

*Leviers pour injecter de l'incertitude :*
- Réensemencement aléatoire entre les manches
- Types de Jetons tirés au sort
- Comportement imprévisible de la Zone Neutre
- Offre de boutique aléatoire (déjà présent)
- Modules à effet probabiliste (à doser TRÈS finement)

*Le contre-risque :* si le joueur ne peut plus planifier son Circuit, on perd exactement ce qui rend le mancala satisfaisant. **C'est LE curseur du projet.** Il se trouve en playtest, pas sur le papier. À tester explicitement dès le v1.

### 13.2 ⚠️ La durée des tours
Une cascade de 30 secondes est grisante la première fois, pénible la centième.
→ **Avance rapide dès le premier prototype.** Plafond dur sur les boucles infinies. Vitesse d'animation réglable dans les options.

### 13.3 ⚠️ La lisibilité
12 Nœuds × (compteur + Module + icône + types de Jetons) = surcharge très rapide.
→ Contrainte : **état lisible en 1 seconde**. Prévisualisation du trajet au survol. Hiérarchie visuelle stricte : le nombre de Jetons d'abord, le Module ensuite.

### 13.4 ⚠️ Les voisins

**Ballionaire** et **Peglin** exploitent déjà la boucle « un objet traverse un parcours et déclenche des trucs ».
→ **À jouer sérieusement**, tous les deux, pour apprendre leur rythme.
→ **Notre différence, à protéger :** chez eux le parcours est **subi** (on lâche l'objet et on regarde). Chez nous il est **choisi** — le joueur décide du point de départ, donc du segment traversé. C'est un jeu de décision, pas de lâcher.

### 13.5 ⚠️ Le scope
150 Modules + 4 topologies + 8 étapes, c'est un projet long pour un débutant.
→ **Le jalon 1 doit être atteignable en 2 semaines.** Tout le reste est du contenu ajouté sur une base qui fonctionne déjà.

---

## 14. Roadmap

### JALON 0 — Le prototype de feel *(objectif : 2 semaines)*

**Sans art, sans boutique, sans méta, sans thème.**

- [ ] Plateau 2×6, distribution, capture en chaîne
- [ ] **Trois Modules seulement** : `+1 Charge`, `×2 Charge`, `Rejouer`
- [ ] Un quota à atteindre en 15 tours
- [ ] Le son des clacs
- [ ] La résolution à rebours de la chaîne

**Critère de réussite, unique et brutal :**
> Est-ce que j'ai envie de relancer une manche ?

Si oui, le jeu existe et tout le reste est du contenu. Si non, on l'aura su en 2 semaines au lieu de 2 ans.

### JALON 1 — La boucle de run
Boutique, 20-30 Modules, 3 étapes, économie, une Épreuve.
→ Test explicite du curseur déterminisme/hasard (§13.1).

### JALON 2 — L'identité
DA choisie et appliquée, nommage complet, sons finalisés, écran-titre.

### JALON 3 — Le contenu
Montée vers 150 Modules, types de Jetons, Outils, 8 étapes, toutes les Épreuves.

### JALON 4 — La profondeur
Topologies alternatives (§9, axe 4), difficultés supplémentaires, déblocables.

---

## 15. Technique

### 15.1 Contexte
Développeur débutant côté graphique. Travail avec Claude Code. Pixel art simple.

### 15.2 LA décision structurante : séparer le cœur du rendu

**Avant même de choisir un moteur**, écrire le moteur de règles comme un **module pur** :
- pas de rendu, pas de son, pas d'entrée utilisateur
- entrée = un état + un coup → sortie = un nouvel état + **une liste ordonnée d'événements**
- entièrement testable en ligne de commande

La liste d'événements (`JETON_DÉPOSÉ`, `MODULE_DÉCLENCHÉ`, `CHAÎNE_MAILLON`, `CHAÎNE_ROMPUE`…) est ce que la couche de présentation consomme pour jouer l'animation et les sons.

**Trois bénéfices majeurs :**
1. Le choix du moteur graphique devient **réversible et non fatal**.
2. On peut équilibrer par simulation (jouer 100 000 runs en batch).
3. Claude Code est **excellent** sur du code pur et testé, beaucoup moins sur du clic dans un éditeur.

### 15.3 Tout est donnée, rien n'est constante
Le nombre de Nœuds, la connectivité du Circuit, le sens, le seuil de capture, la longueur de chaîne : **des paramètres**, jamais des valeurs en dur. C'est ce qui rendra possible l'axe 4 de rejouabilité (§9) sans réécrire le jeu.

### 15.4 Options de stack

| Option | Langage | Pour | Contre |
|---|---|---|---|
| **Web / Canvas ou PixiJS** | TypeScript | Itération instantanée, zéro friction de build, partage de prototypes par lien, Claude Code très à l'aise | Empaquetage Steam via Tauri/Electron, moins « natif » |
| **LÖVE2D** | Lua | **C'est le moteur de Balatro.** Très simple, parfait en 2D, exportable Steam, tout en texte | Écosystème plus petit, moins d'outillage |
| **Godot 4** | GDScript | Éditeur complet, excellent pixel art, export partout, gratuit | Un peu plus lourd, travail partiellement dans l'éditeur donc moins adapté à un flux 100 % Claude Code |
| Unity | C# | — | Surdimensionné pour ce projet |

### 15.5 Recommandation
**Jalon 0 en TypeScript/web**, pour la vitesse d'itération et parce que le feel se teste en rechargeant une page en une seconde.
**Décision du moteur final reportée au jalon 2**, une fois le cœur écrit et isolé — grâce à §15.2, ce choix ne coûtera pas le projet.

---

## 16. Décisions à prendre

| # | Sujet | État |
|---|---|---|
| 1 | Direction artistique (§10) | ⏳ Ouvert — après jalon 0 |
| 2 | Nom du jeu | ⏳ Ouvert — dépend de la DA |
| 3 | Curseur déterminisme / hasard (§13.1) | ⏳ À trancher en playtest, jalon 1 |
| 4 | Moteur graphique final (§15.4) | ⏳ Reporté au jalon 2 |
| 5 | Coût de déplacement d'un Module (§6.6) | ⏳ À équilibrer |
| 6 | Nombre de Jetons au réensemencement | ⏳ À équilibrer |
| 7 | Garde-t-on les greniers du Kalah ? | ⏳ Probablement non (redondant avec la Moisson) |
| 8 | Progression méta entre les runs | ⏳ Ouvert — minimale par principe (§12) |

---

## 17. Glossaire

- **Nœud** — une des 12 positions du Circuit.
- **Jeton** — l'unité qui circule.
- **Circuit** — la boucle orientée reliant les Nœuds.
- **Distribuer** — vider un Nœud et déposer ses Jetons un par un.
- **Moisson** — la capture en chaîne de fin de tour, résolue à rebours.
- **Charge** — le multiplicateur accumulé pendant le trajet.
- **Zone Neutre** — le territoire non joueur, seul endroit moissonnable.
- **Module** — l'amélioration posée sur un Nœud (notre « joker »).
- **Outil** — modificateur global de règle.
- **Épreuve** — manche-boss, qui casse une règle.
- **Étape** — groupe de 3 manches.
- **Run** — une partie complète, 8 étapes.

---

## 18. Journal des décisions

**Session 1**
- Choix du mancala (Awalé) comme base mécanique, parmi une liste de ~120 jeux anciens étudiés. Finalistes écartés : cribbage (trop proche de Balatro), football à la craie (excellent, à garder en réserve pour un futur projet), Shut the Box, trictrac, fanorona.
- Décision : **les Modules sont posés sur le Circuit**, pas dans une barre. La position compte. C'est l'angle du projet.
- Décision : **capture en chaîne de l'Awalé** + **règle « rejouer » du Kalah**.
- Décision : **pas d'IA adverse**, la rangée adverse devient la Zone Neutre.
- Décision : **séparation stricte mécanique / thématique**, vocabulaire neutre obligatoire (§4).
- Décision : **DA agricole rejetée**. Pistes ouvertes autour du cadran à 12 positions (alchimie, horlogerie, astrologie).
- Décision : **jalon 0 = feel uniquement**, 3 Modules, 2 semaines.
