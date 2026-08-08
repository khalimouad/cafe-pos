# Agent d'impression — imprimante ticket ESC/POS

Le POS tourne dans un navigateur, et un navigateur ne peut pas ouvrir de connexion TCP
brute vers une imprimante. Ce petit service fait le pont : il reçoit les octets ESC/POS
du POS et les envoie sur le port 9100 de l'imprimante. Résultat : le ticket sort **sans
boîte de dialogue d'impression**, dès la validation du panier.

## L'imprimante

D'après son autotest :

| | |
|---|---|
| Interface | USB et Ethernet 10/100, protocole TCP/IP |
| IP | `192.168.123.100` (DHCP désactivé, IP fixe) |
| Port | `9100` (impression brute) |
| Largeur d'impression | 72 mm, soit 576 points |
| Massicot / bipeur | oui |

## Le plus simple : laisser l'agent servir le POS

Si le dossier `dist/` du POS est présent à côté (c'est le cas dans ce dépôt après
`npm run build`), l'agent le sert lui-même. Le POS et l'impression partagent alors la
**même adresse**, ce qui supprime d'un coup les trois causes classiques de « Failed to
fetch » : mauvaise IP, blocage HTTPS → HTTP, et restrictions entre origines.

```bash
npm install && npm run build     # à la racine du dépôt, une fois
node printer-agent/agent.mjs     # sur le poste du café
```

Puis ouvrir **http://IP-DU-POSTE:7777** — sur le poste comme sur le téléphone du gérant.
Le réglage *Adresse de l'agent* reste sur `auto` : le POS s'adresse à l'agent qui l'a
servi, quelle que soit l'IP du poste.

## Installation sur le poste du café

1. Installer [Node.js](https://nodejs.org) 18 ou plus.
2. Copier ce dossier sur le poste, puis lancer :

```bash
node agent.mjs
```

L'agent écoute sur le port **7777** et accepte les demandes des autres appareils du
réseau (le téléphone du gérant, par exemple).

Variables d'environnement disponibles : `PORT`, `HOST`, `PRINTER_IP`, `PRINTER_PORT`,
`PRINTER_TIMEOUT`.

### Le démarrer automatiquement

**Windows** — créer un raccourci vers `node agent.mjs` dans
`shell:startup` (touche Windows + R, taper `shell:startup`).

**Linux (systemd)** :

```ini
# /etc/systemd/system/cafe-printer-agent.service
[Unit]
Description=Agent d'impression POS Café
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/cafe-pos/printer-agent/agent.mjs
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cafe-printer-agent
```

## Imprimante branchée en USB

> **Sous Windows, ne choisissez pas « USB ».** Le port `USB001` affiché dans les
> propriétés de l'imprimante n'est pas accessible en écriture directe : c'est le
> spouleur Windows qui le pilote. Choisissez **Windows (imprimante installée)** et
> donnez le nom de l'imprimante (ex. `printer WD8260`) — le ticket passera bien par le
> câble USB. Le branchement *USB* de la liste ne concerne que Linux et macOS, où le
> port apparaît comme un fichier `/dev/usb/lp0`.

La même imprimante fonctionne aussi en USB : le POS ne change pas, seul le
**branchement** choisi dans les réglages diffère. L'agent reste indispensable, un
navigateur ne pouvant pas plus écrire sur un port USB qu'ouvrir une socket TCP.

| Système | Branchement à choisir | Cible à renseigner |
|---------|----------------------|--------------------|
| Linux | **USB** | `/dev/usb/lp0` (l'agent liste les ports détectés) |
| macOS | **File d'impression CUPS** | nom de la file, ex. `POS80` |
| Linux (via CUPS) | **File d'impression CUPS** | nom de la file, ex. `POS80` |
| Windows | **Windows (imprimante installée)** | nom Windows, ex. `printer WD8260` |

**Linux** — le port apparaît en `/dev/usb/lp0`. Si l'agent répond « droits
insuffisants », ajouter l'utilisateur au groupe propriétaire du port :

```bash
ls -l /dev/usb/lp0            # ex. root lp
sudo usermod -aG lp $USER     # puis se reconnecter
```

**Windows** — le pilote de l'imprimante étant installé, il suffit de reprendre le **nom
exact affiché dans Windows** (par exemple `printer WD8260`) et de choisir *Windows
(imprimante installée)*. Aucun partage à configurer : l'agent envoie les octets au
spouleur en mode **RAW**, donc le pilote ne redessine rien et l'imprimante reçoit
l'ESC/POS tel quel. Le bouton *Tester la connexion* liste les imprimantes installées et
vérifie que le nom existe.

Le champ accepte aussi un chemin de partage (`\\poste\POS80`) si l'imprimante est
partagée depuis un autre PC : dans ce cas l'agent utilise `copy /b`.

Pour retrouver le nom exact :

```powershell
(Get-Printer).Name
```

**macOS / Linux avec CUPS** — créer une file en mode brut :

```bash
lpadmin -p POS80 -E -v usb://... -m raw     # lpinfo -v liste les URI USB
```

## Réglage dans le POS

**Réglages → Imprimante ticket** : activer l'impression directe, choisir le
**branchement** (réseau, USB, CUPS ou partage Windows), renseigner l'adresse de l'agent
(`http://127.0.0.1:7777` sur le poste lui-même, ou `http://IP-DU-POSTE:7777` depuis un
téléphone) puis la cible correspondante — IP et port en réseau, port USB sinon. Les
boutons **Tester la connexion** et **Imprimer un ticket de test** vérifient le montage.

Si l'agent ou l'imprimante ne répond pas, le POS bascule automatiquement sur le dialogue
d'impression du navigateur : le ticket sort quand même.

## POS hébergé en ligne (https) et agent sur le poste

Si le POS est ouvert depuis une adresse **https** (hébergement en ligne) et non depuis
l'agent, le navigateur n'autorise qu'**une seule** adresse http : celle de la machine
elle-même, `http://127.0.0.1:7777`. C'est ce que `auto` choisit tout seul dans ce cas.

Conséquences à connaître :

- **sur le poste du café**, l'impression fonctionne : la page https appelle l'agent local ;
- **depuis le téléphone**, elle ne peut pas : `http://192.168.1.x:7777` est refusé par le
  navigateur au nom du contenu mixte. Pour imprimer depuis un autre appareil, ouvrez le
  POS depuis l'agent (`http://IP-DU-POSTE:7777`) plutôt que depuis l'adresse en ligne.

L'agent répond à l'autorisation « accès au réseau privé » que Chrome et Edge exigent dans
ce montage ; rien à configurer de votre côté.

## « Failed to fetch » : que vérifier

Dans l'ordre :

1. **L'agent tourne-t-il ?** Sur le poste, ouvrir <http://127.0.0.1:7777/health> : du
   texte JSON doit s'afficher.
2. **Depuis le téléphone**, ouvrir `http://IP-DU-POSTE:7777/health`. Rien ne vient ? Le
   pare-feu Windows bloque le port :

   ```powershell
   New-NetFirewallRule -DisplayName "POS Cafe - agent impression" `
     -Direction Inbound -Protocol TCP -LocalPort 7777 -Action Allow -Profile Private
   ```

3. **La page du POS est-elle en HTTPS ?** Elle ne peut alors joindre que
   `http://127.0.0.1:7777`. Une erreur « NOT_FOUND » venant du site hébergé signifie que
   le POS a cherché l'agent à sa propre adresse : laissez le réglage sur `auto`, il
   choisit désormais l'agent local dans ce cas.
4. **L'IP du poste a changé ?** Avec `auto`, la question ne se pose plus ; sinon, penser
   à réserver l'adresse dans la box.

## Vérifier à la main

```bash
# réseau
curl "http://127.0.0.1:7777/health?transport=tcp&ip=192.168.123.100&port=9100"
printf 'Test\n\n\n\n' | curl -X POST --data-binary @- \
  "http://127.0.0.1:7777/print?transport=tcp&ip=192.168.123.100&port=9100"

# USB (la réponse /health liste aussi les ports USB détectés)
curl "http://127.0.0.1:7777/health?transport=usb&target=/dev/usb/lp0"
printf 'Test\n\n\n\n' | curl -X POST --data-binary @- \
  "http://127.0.0.1:7777/print?transport=usb&target=/dev/usb/lp0"
```

## Sécurité

L'agent n'a aucune authentification et imprime pour quiconque peut l'atteindre : à
n'exposer que sur le réseau local du café, jamais sur internet.

## Ce que reçoit l'imprimante

Le ticket est dessiné par le navigateur puis envoyé en **image raster** (`GS v 0`), suivi
d'une avance papier, du bip optionnel et de la coupe (`GS V 66`). Comme c'est le
navigateur qui compose l'image, la darija s'imprime avec les bonnes liaisons de lettres
et le bon sens d'écriture, sans dépendre des jeux de caractères de l'imprimante.
