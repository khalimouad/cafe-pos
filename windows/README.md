# Lancer le POS sur le poste Windows

## Le point important : installer l'app ≠ supprimer le dialogue d'impression

Installer le POS comme application (Chrome ou Edge → **Installer cette application**)
donne une fenêtre propre, sans barre d'adresse ni onglets, avec une icône dans le menu
Démarrer. Mais **le dialogue d'impression continue de s'afficher** : aucune page web ne
peut le désactiver toute seule, c'est une protection du navigateur.

Deux façons de ne plus le voir :

| Méthode | Comment | Ce que ça donne |
|---|---|---|
| **Mode kiosque** (`--kiosk-printing`) | le raccourci `Lancer-POS-Cafe.cmd` | Le navigateur imprime **sans rien demander**, sur l'imprimante **par défaut** de Windows |
| **Impression directe** | Réglages → Imprimante ticket → *Impression directe : Oui* | Le POS envoie l'ESC/POS à l'imprimante par l'agent : coupe et bip compris, sans passer par le pilote |

Les deux fonctionnent ensemble : si l'impression directe est activée, le mode kiosque
ne sert plus qu'à l'affichage plein écran.

## Démarrage en un clic

Double-cliquez sur **`Lancer-POS-Cafe.cmd`**. Il :

1. démarre l'agent d'impression s'il ne tourne pas déjà (il sert aussi la page du POS) ;
2. ouvre Edge — ou Chrome à défaut — en **plein écran**, avec `--kiosk-printing`.

Avant le premier lancement, une seule fois, à la racine du dépôt :

```bash
npm install
npm run build
```

### Adapter l'adresse

Le fichier `.cmd` pointe sur `http://127.0.0.1:7777`, l'agent installé sur ce poste.
Modifiez la ligne `set "POS_URL=..."` si le POS est ailleurs.

### Démarrer automatiquement à l'ouverture de session

Touche Windows + R, taper `shell:startup`, puis y déposer un **raccourci** vers
`Lancer-POS-Cafe.cmd`.

## Impression sans dialogue : ce qu'il faut vérifier

Avec `--kiosk-printing`, le navigateur imprime **sur l'imprimante par défaut**, sans
demander. Donc :

- **`printer WD8260` doit être l'imprimante par défaut** de Windows
  (Paramètres → Bluetooth et appareils → Imprimantes et scanners → *Définir par défaut*,
  après avoir décoché « Laisser Windows gérer mon imprimante par défaut ») ;
- format de papier **80 mm** dans les propriétés du pilote, marges minimales.

## Installer le POS comme application

Dans Edge : menu **…** → *Applications* → **Installer ce site en tant qu'application**.
Dans Chrome : icône d'installation dans la barre d'adresse, ou menu → *Diffuser,
enregistrer et partager* → **Installer**.

L'application s'installe alors avec son icône et s'ouvre dans sa propre fenêtre. Pour
qu'elle soit aussi **sans dialogue d'impression**, lancez-la plutôt par le raccourci
ci-dessus : une application installée ne peut pas ajouter le drapeau `--kiosk-printing`
elle-même.

## Le dialogue s'affiche encore : les trois causes

Le drapeau `--kiosk-printing` ne vaut **que pour la fenêtre lancée avec lui**. Ouvrir le
POS autrement — icône Edge habituelle, application installée, onglet déjà ouvert — fait
revenir le dialogue.

### 1. Vérifier que le drapeau est bien actif

Dans la fenêtre où le dialogue apparaît, ouvrir un nouvel onglet sur **`edge://version`**
(ou `chrome://version`) et regarder la ligne **Ligne de commande**. Elle doit contenir
`--kiosk-printing`. Si elle ne le contient pas, la fenêtre n'a pas été lancée par le
raccourci.

### 2. Edge était déjà ouvert

Si une fenêtre Edge tourne déjà avec le même profil, la nouvelle demande lui est
simplement transmise et **les drapeaux sont ignorés**. Le raccourci fourni évite cela en
utilisant un profil dédié (`--user-data-dir`). En cas de doute : fermer toutes les
fenêtres Edge, puis relancer `Lancer-POS-Cafe.cmd`.

### 3. Vous utilisez l'application installée

Une application installée ne peut pas ajouter le drapeau elle-même. Deux solutions :

- lancer le POS par **`Lancer-POS-Cafe.cmd`** plutôt que par l'icône de l'application ;
- ou exécuter **`Ajouter-kiosk-printing-a-l-app-installee.ps1`** (clic droit → *Exécuter
  avec PowerShell*), qui ajoute `--kiosk-printing` au raccourci de l'application
  installée. Refermer complètement la fenêtre de l'application, puis la rouvrir par son
  raccourci.

## La solution qui ne dépend pas du navigateur

L'**impression directe** du POS (Réglages → Imprimante ticket → *Impression directe :
Oui*) ne passe pas par le navigateur du tout : le ticket est envoyé à l'imprimante par
l'agent. Aucun dialogue, quel que soit le mode de lancement, et en prime la coupe
automatique et le bip — que `--kiosk-printing` ne sait pas piloter.

L'agent tourne déjà si vous utilisez `Lancer-POS-Cafe.cmd` : il n'y a qu'à activer le
réglage.

## Sortir du mode kiosque

`Alt + F4` ferme la fenêtre. `Ctrl + W` et la touche Windows restent disponibles.
