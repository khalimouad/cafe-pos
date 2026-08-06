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

## Réglage dans le POS

**Réglages → Imprimante ticket** : activer l'impression directe, renseigner l'adresse de
l'agent (`http://127.0.0.1:7777` sur le poste lui-même, ou `http://IP-DU-POSTE:7777`
depuis un téléphone), l'IP et le port de l'imprimante, puis **Tester l'impression**.

Si l'agent ou l'imprimante ne répond pas, le POS bascule automatiquement sur le dialogue
d'impression du navigateur : le ticket sort quand même.

## Vérifier à la main

```bash
curl "http://127.0.0.1:7777/health?ip=192.168.123.100&port=9100"
printf 'Test\n\n\n\n' | curl -X POST --data-binary @- \
  "http://127.0.0.1:7777/print?ip=192.168.123.100&port=9100"
```

## Sécurité

L'agent n'a aucune authentification et imprime pour quiconque peut l'atteindre : à
n'exposer que sur le réseau local du café, jamais sur internet.

## Ce que reçoit l'imprimante

Le ticket est dessiné par le navigateur puis envoyé en **image raster** (`GS v 0`), suivi
d'une avance papier, du bip optionnel et de la coupe (`GS V 66`). Comme c'est le
navigateur qui compose l'image, la darija s'imprime avec les bonnes liaisons de lettres
et le bon sens d'écriture, sans dépendre des jeux de caractères de l'imprimante.
