# Inventaire — GitHub Pages + Supabase

Application web statique, prévue pour être publiée sur GitHub Pages. Aucun serveur Python, aucun Docker, aucune VM nécessaire pour héberger le frontend.

## Architecture
- **GitHub Pages** : héberge `index.html`, CSS et JavaScript.
- **Supabase** : authentification Google, base PostgreSQL, photos privées (Storage) et droits d'accès.
- **Email OTP** : prévu pour une prochaine version. Supabase Auth permet de l'ajouter sans refaire l'application.

## 1. Créer le dépôt GitHub

1. Sur GitHub, crée un nouveau dépôt nommé `inventaire` (Public si tu veux utiliser GitHub Pages gratuitement).
2. Envoie tous les fichiers de ce dossier à la racine du dépôt.
3. Copie `config.example.js` sous le nom `config.js`, puis renseigne l'URL et la clé publique de ton projet Supabase.
4. Dans GitHub : **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.
5. L'adresse sera normalement `https://TON-PSEUDO.github.io/inventaire/`.

> `config.js` contient uniquement l'URL Supabase et la clé anon/publishable prévue pour le navigateur. Ne mets JAMAIS la clé `service_role`, un mot de passe ou un secret OAuth dans ce fichier ou dans GitHub.

## 2. Créer le projet Supabase

1. Crée un projet sur https://supabase.com/ (la formule gratuite suffit pour commencer, dans les limites du service).
2. Dans **Project Settings → API**, récupère :
   - Project URL
   - anon / publishable key
3. Mets ces valeurs dans `config.js`.
4. Ouvre **SQL Editor → New query**, colle tout le contenu de `supabase/schema.sql`, puis exécute-le.

## 3. Configurer Google

1. Dans Supabase : **Authentication → Sign In / Providers → Google**, active Google.
2. Dans Google Cloud Console, configure un client OAuth de type Web.
3. Dans les URI de redirection autorisées Google, ajoute l'URL callback affichée par Supabase (elle ressemble à `https://PROJET.supabase.co/auth/v1/callback`).
4. Dans Supabase **Authentication → URL Configuration** :
   - Site URL : `https://TON-PSEUDO.github.io/inventaire/`
   - Redirect URLs : ajoute `https://TON-PSEUDO.github.io/inventaire/**`
5. Renseigne le Client ID et le Client Secret dans le fournisseur Google de Supabase. Ces secrets restent dans Supabase, jamais dans le dépôt.

## 4. Activer le premier administrateur

1. Publie le site et connecte-toi une première fois avec ton compte Google.
2. Le compte est créé mais reste bloqué (c'est volontaire).
3. Dans Supabase → SQL Editor, exécute en remplaçant l'adresse :

```sql
update public.profiles
set role = 'admin', is_active = true
where email = 'TON.ADRESSE@EXEMPLE.FR';
```

4. Déconnecte-toi puis reconnecte-toi. Dans **Utilisateurs**, l'admin peut activer les nouveaux comptes et choisir leur rôle.

Rôles :
- **Administrateur** : utilisateurs, catégories, suppression et gestion complète.
- **Éditeur** : création et modification des fiches, ajout de photos.
- **Lecteur** : consultation.

## 5. Photos

Les photos sont stockées dans le bucket privé Supabase `equipment-photos`. L'application génère des liens temporaires signés pour les afficher. Le bucket limite les fichiers à 12 Mo et accepte JPG, PNG et WebP.

## Fonctionnalités présentes
- Connexion Google et inventaire partagé multi-utilisateurs.
- Rôles et activation des comptes.
- Tableau de bord, recherche et filtres.
- Catégories personnalisables.
- Fiches matériel : quantité, état, marque, modèle, numéro de série, emplacement.
- Suivi d'achat, prix, fournisseur, garantie.
- Photos multiples et stockage privé.
- Historique des créations, modifications et changements d'état.
- Interface responsive, thème sombre.

## À savoir avant publication publique
- Le dépôt GitHub Pages public rend le code et `config.js` visibles. C'est normal pour une app statique. La sécurité des données repose sur les politiques RLS Supabase, pas sur le secret de la clé publique.
- Ne jamais publier la clé `service_role`.
- La V1 est un prototype fonctionnel à valider. Avant usage sensible, faire auditer les règles RLS et tester les droits avec trois comptes (admin, éditeur, lecteur).
- L'historique V1 journalise les créations et modifications faites depuis l'interface ; une V2 pourra compléter avec un journal serveur non falsifiable, suppression de photos individuelles, export et mouvements de stock.
- Le code OTP par e-mail n'est pas activé dans cette version : il sera ajouté ultérieurement via Supabase Auth / SMTP personnalisé.

## Dépannage rapide
- **Connexion refusée après Google** : vérifie Site URL / Redirect URLs Supabase et l'URL callback Google.
- **Compte en attente** : active-le via la requête SQL admin ci-dessus.
- **Erreur de permission** : vérifie que `schema.sql` a été exécuté intégralement et que l'utilisateur est actif.
- **Page blanche** : vérifie `config.js`, les erreurs de console du navigateur et que les fichiers sont à la racine du dépôt.
