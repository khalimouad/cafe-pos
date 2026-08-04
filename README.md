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

Aucune base de données ni serveur : tout est enregistré dans le navigateur du poste
(localStorage). Le poste garde donc son historique même après fermeture du navigateur.

## Codes par défaut

| Caissier | Code | Rôle |
|----------|------|------|
| Youssef  | 1111 | Responsable (accès Réglages) |
| Salma    | 2222 | Caissier |
| Karim    | 3333 | Caissier |

À changer dans **Réglages → Caissiers** dès la mise en service.

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

## Sur téléphone

- Barre de navigation en bas : Caisse, Historique, Réglages, Fermer la caisse
- Le panier devient une feuille glissante ; une barre fixe affiche en permanence
  le nombre d'articles, le total et le bouton **Valider & imprimer**
- Grille de produits adaptée aux petits écrans, zones de touche agrandies

## Langue

Le bouton **FR / دارجة** change toute l'interface *et* le ticket imprimé.
Le choix est mémorisé sur le poste. En darija l'affichage passe en RTL, mais les
montants, dates et codes restent lus de gauche à droite.

## Réglages (responsable)

- Nom, adresse, téléphone, devise et message de bas de ticket
- Carte : ajout de produits, modification des prix, masquage d'un produit
- Caissiers : ajout, changement de code, suppression

## Impression

L'impression utilise la boîte de dialogue du navigateur avec une mise en page 80 mm.
Pour une imprimante ticket : la définir comme imprimante par défaut et activer
l'impression sans boîte de dialogue (Chrome : lancer avec `--kiosk-printing`).
