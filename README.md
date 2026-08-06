# Café POS — caisse simple pour café

POS tactile pensé pour **un seul poste de caisse** dans un café, **paiement en espèces uniquement**.
Pas de commandes multiples : on compose le panier, on valide, c'est payé et le ticket s'imprime.

Interface **bilingue français / darija marocaine** (bascule FR ⇄ دارجة en haut de l'écran,
passage automatique en RTL) et **utilisable sur téléphone** comme sur poste fixe.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # version de production dans dist/
```

Les données vivent dans **Supabase** (PostgreSQL) : le poste de caisse, le téléphone du
gérant et n'importe quel autre appareil voient la même caisse, en temps réel. Les clés
sont dans `.env` (voir `.env.example`) ; la clé publiable est faite pour être exposée
au navigateur, la sécurité est assurée en base par RLS.

Le schéma est versionné dans `supabase/migrations/0001_cafe_pos.sql`. Les tables sont
préfixées `cafe_` car le projet Supabase héberge aussi le POS de la boucherie.

## Codes par défaut

| Caissier | Code | Rôle |
|----------|------|------|
| Youssef  | 1111 | Responsable (accès Réglages) |
| Salma    | 2222 | Caissier |
| Karim    | 3333 | Caissier |

À changer dans **Réglages → Caissiers** dès la mise en service.

Les codes ne sont **jamais lisibles** depuis le navigateur : ils restent en base et sont
vérifiés par la fonction `cafe_verify_pin`. Après 5 essais ratés, le profil est bloqué
60 secondes. Dans les réglages, on ne peut donc que *remplacer* un code, pas le lire.

## Fonctionnement

1. **Login caissier** — chaque caissier a son code à 4 chiffres. Le bouton *Changer*
   en haut à droite permet de passer la main sans fermer la caisse.
2. **Ouverture de caisse** — on saisit le fond de caisse en espèces. Une seule caisse
   ouverte à la fois (un seul poste), partagée par tous les caissiers.
3. **Vente** — on touche les produits, on ajuste les quantités, puis
   **Valider & imprimer** : la commande est enregistrée comme payée en espèces et le
   ticket part directement à l'imprimante (format 80 mm). Pas d'écran de rendu de monnaie.
4. **Historique** — toutes les commandes, filtrables par session / jour / tout et par
   caissier, avec total encaissé, ticket moyen, répartition par caissier et réimpression
   d'un ticket.
5. **Fermeture de caisse** — récapitulatif (tickets, ventes, fond de caisse, détail par
   caissier), saisie des espèces comptées, calcul de l'écart, puis impression du rapport Z.

## Plusieurs appareils, une seule caisse

Le poste du café et le téléphone du gérant regardent la **même** caisse : la session
ouverte, les commandes, l'historique et la carte vivent en base, pas dans le navigateur.

- Une seule caisse peut être ouverte à la fois, garanti par un index unique en base :
  impossible d'en ouvrir une deuxième depuis un autre appareil.
- Ce que fait le poste apparaît sur le téléphone **en direct**, sans rien recharger
  (Supabase Realtime, avec un rafraîchissement de secours toutes les 60 secondes).
- Chaque appareil reste connecté : le téléphone ne redemande pas le code à chaque
  ouverture. Le bouton **Changer** déconnecte l'appareil.
- Fermer la caisse depuis le poste bascule aussi le téléphone sur « Caisse fermée ».
- Le **panier en cours** reste propre à l'appareil qui le compose : deux appareils
  peuvent encaisser chacun leur commande sans se gêner, les tickets étant numérotés
  par la base.

## Sur téléphone

- Barre de navigation en bas : Caisse, Historique, Réglages, Fermer la caisse
- Le panier devient une feuille glissante ; une barre fixe affiche en permanence
  le nombre d'articles, le total et le bouton **Valider & imprimer**
- Grille de produits adaptée aux petits écrans, zones de touche agrandies

## Langue

Le bouton **FR / دارجة** change toute l'interface *et* le ticket imprimé.
Le choix est mémorisé sur le poste. En darija l'affichage passe en RTL, mais les
montants, dates et codes restent lus de gauche à droite.

## Base de données

| Table | Contenu |
|-------|---------|
| `cafe_shop` | nom, adresse, téléphone, devise, bas de ticket |
| `cafe_cashiers` | caissiers + code (jamais exposé) ; vue `cafe_cashiers_public` sans le code |
| `cafe_products` | la carte |
| `cafe_sessions` | ouvertures/fermetures de caisse (index unique : une seule caisse ouverte) |
| `cafe_orders` | commandes payées, numérotées par séquence, lignes en JSON |
| `cafe_pin_attempts` | compteur d'essais de code, pour le blocage temporaire |

L'application se resynchronise en temps réel (Realtime) et, en secours, toutes les
60 secondes. Si la base est injoignable, un bandeau « Hors ligne » s'affiche : la vente
est bloquée tant que la commande ne peut pas être enregistrée, pour ne jamais imprimer
un ticket qui n'existe pas en base.

## Réglages (responsable)

- Nom, adresse, téléphone, devise et message de bas de ticket
- Carte : ajout de produits, modification des prix, masquage ou suppression d'un
  produit (les commandes déjà passées gardent leur libellé et leur prix)
- Caissiers : ajout, changement de code, suppression — impossible de supprimer le
  dernier caissier ni le dernier responsable

## Impression

Le ticket part **directement** sur l'imprimante thermique 80 mm, sans boîte de dialogue.

Un navigateur ne peut ni ouvrir une socket TCP ni écrire sur un port USB : un petit
agent Node tourne donc sur le poste du café et fait le pont. Voir
**[`printer-agent/`](printer-agent/)** pour l'installation et le démarrage automatique.

Le plus simple est de laisser cet agent **servir aussi le POS** (`node
printer-agent/agent.mjs` après `npm run build`, puis ouvrir `http://IP-DU-POSTE:7777`) :
page et impression partagent la même adresse, et le réglage *Adresse de l'agent* peut
rester sur `auto`.

L'imprimante peut être branchée **en réseau** (IP fixe `192.168.123.100`, port brut
`9100` — le montage actuel) ou **en USB** ; le branchement se choisit dans les réglages :
réseau, USB (`/dev/usb/lp0` sous Linux), file d'impression CUPS, ou imprimante installée
sous Windows désignée par son nom (ex. `printer WD8260`, envoi au spouleur en mode RAW).

Le ticket est dessiné par le navigateur puis envoyé en image raster ESC/POS (`GS v 0`),
suivi de la coupe (`GS V 66`) et du bip optionnel. C'est le navigateur qui compose
l'image, donc la darija sort avec les bonnes liaisons de lettres et le bon sens
d'écriture, sans dépendre des jeux de caractères de l'imprimante.

Réglages → **Imprimante ticket** : activation, adresse de l'agent, IP et port de
l'imprimante, coupe, bip, test de connexion et ticket de test. Si l'agent ou
l'imprimante ne répond pas, le POS bascule automatiquement sur le dialogue d'impression
du navigateur et le signale — la commande, elle, est déjà enregistrée.
