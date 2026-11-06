# 🟢 Mettre Locho en ligne — GRATUITEMENT, pas à pas

> **Budget requis : 0 €.** Ni carte bancaire, ni ligne de commande, ni connaissance
> technique. Vous allez cliquer dans des sites web, c'est tout. Comptez ~15 minutes.

**Ce que vous aurez à la fin** : une vraie adresse internet du type
`https://locho-xxxx.vercel.app`, accessible 24 h/24 depuis n'importe quel téléphone,
avec votre base de données gratuite. Le site **s'installe tout seul** au premier
lancement (tables + données) : aucune manipulation technique à faire.

---

## Les 3 comptes gratuits à créer

Trois services, gratuits, sans carte bancaire — chacun a besoin de **votre e-mail**,
c'est impossible de les créer à votre place.

| Service | Rôle | Tarif | Carte bancaire |
|---|---|---|---|
| **GitHub** | range vos fichiers (comme un Google Drive) | gratuit, illimité | ❌ |
| **Neon** | votre base de données (1 Go) | gratuit | ❌ |
| **Vercel** | héberge le site, donne l'URL, HTTPS compris | gratuit | ❌ |

> ⚠️ **Deux règles de sécurité à retenir** — tout le reste suit :
> 1. Ne **montrez jamais** à personne les mots de passe de l'étape 4.
> 2. Ne modifiez jamais (et ne partagez jamais) le fichier `.env` du projet.

---

## Étape 1 — GitHub (2 min)

1. Allez sur **github.com** → **Sign up** (e-mail, mot de passe, pseudo).
2. Une fois connecté → bouton vert **New repository** (nouveau dépôt).
3. *Repository name* : `locho` → cochez **Public** → **Create repository**.
   (Public = nécessaire pour que Vercel puisse le récupérer gratuitement.)

## Étape 2 — Déposer les fichiers du projet (3 min)

1. Sur la page de votre nouveau dépôt : **Add file** → **Upload files**.
2. Ouvrez le dossier du projet sur **votre ordinateur**.
3. **Sélectionnez tout** (Ctrl+A) puis **retirez ces 3 éléments** (Ctrl+clic) :
   - ❌ `node_modules`
   - ❌ `.next`
   - ❌ `.env`
4. **Glissez-déposez** la sélection dans la page GitHub → puis cliquez
   **Commit changes** → *commit* : `Locho v1`.

✅ Le dépôt est en ligne. (Les 3 éléments exclus sont justement ce qui ne doit
jamais partir sur internet.)

## Étape 3 — Neon : votre base de données gratuite (3 min)

1. Allez sur **neon.tech** → **Sign up → Continue with GitHub** (un clic, même compte).
2. Choisissez la région **Frankfurt (eu-central-1)** (la plus proche de la France).
3. Projet créé → en haut à gauche, onglet **Connection details** (Détails de connexion).
4. Choisissez : *Environment* = **Production**, *Protocol* = **PostgreSQL**,
   *SSL mode* = **Require**, *Database* = `neondb`.
5. ⭐ Cliquez sur **Pooled connection string** (ou l'icône de copiage) → **Copiez-le**.
6. Collez-le tout de suite dans un **bloc-notes** : vous allez en avoir besoin.

> C'est tout pour Neon. Ne touchez à rien d'autre — le site créera ses tables
> automatiquement au premier lancement.

## Étape 4 — Vercel : l'hébergeur qui donne l'URL (5 min)

1. Allez sur **vercel.com** → **Sign up → Continue with GitHub**.
2. **Add New… → Project** → trouvez le dépôt `locho` → **Import**.
3. ⛔ **N'appuyez PAS encore sur Deploy.** Un peu plus bas, il y a la section
   **Environment Variables** (variables d'environnement) : cliquez **Add** et
   ajoutez ces 4 lignes — remplacez les valeurs « à définir » par les vôtres,
   et notez-les bien sur un papier :

   | Name (clé) | Value (valeur) |
   |---|---|
   | `DATABASE_URL` | **collez le lien de l'étape 3** (celui du bloc-notes) |
   | `ADMIN_PSEUDO` | votre pseudo admin, ex. `direction` |
   | `ADMIN_PASSWORD` | **inventez un mot de passe admin solide (8+ caractères)** |
   | `DEMO_PASSWORD` | **inventez un second mot de passe** (comptes de démo) |

4. Cliquez **Deploy** → patientez 1 à 2 minutes : le texte passe en vert
   **Congratulations! Your project has been deployed** 🎉
5. Votre adresse internet s'affiche en haut : **`https://…vercel.app`**
   → **cliquez dessus : Locho est en ligne !**

## Étape 5 — Vérifier (1 min)

- Ouvrez votre URL : vous retrouvez la **version B** (6 commerces, 33 produits).
- **Première visite un peu lente (2–5 s) ?** C'est normal : Neon est en veille et
  se réveille. Ensuite tout est rapide.
- Testez l'administration : **avatar en haut à droite → Se connecter** avec
  `ADMIN_PSEUDO` / `ADMIN_PASSWORD` que vous avez choisis (et **non**
  `admin` / `loches37`).
- Teste aussi : `https://VOTRE-URL/api/health` doit afficher `{"ok":true}`.

---

## Vos mots de passe — à conserver précieusement

| Usage | Où l'entrer | Vous avez choisi |
|---|---|---|
| Admin (réglages, validations, finances) | votre URL | `ADMIN_PSEUDO` + `ADMIN_PASSWORD` |
| Démo : `camille`, `marcel`, `yanis` | votre URL | mot de passe = `DEMO_PASSWORD` |
| Base de données | secret, gardé dans Vercel | récupérable sur Neon si besoin |

> **Si vous perdez votre mot de passe admin** : connectez-vous sur neon.tech →
> votre projet → **SQL Editor** → collez ce texte → **Run**, puis reconnectez-vous
> avec le mot de passe `Locho2026!` (changez-le aussitôt dans Vercel) :
>
> ```sql
> UPDATE users SET password_hash = 'bd544b78e60c851f419b8b4305bf505e:24397188ce89aa595c88ec2d88cfd6c951d41b4b77b1b1c83e56c3015a79ca1412e1ea9cac7ddd9907ac91596c65189def13fbfc0140c08c606a6d6d1b5c28d2' WHERE role = 'admin';
> ```

## Choisir entre « version complète » et « base vide »

Par défaut votre site contient les données de démo (version B). Si vous préférez
**une base entièrement vierge** (vous seul, admin) : ajoutez une 5ᵉ variable dans
**Vercel → Settings → Environment Variables** : `SEED_DEMO` = `0`, puis
**Deployments → … → Redeploy**.

## Mettre le site à jour plus tard (2 min)

Vous avez modifié des fichiers ? → **GitHub → Add file → Upload files** (remplacez
les fichiers concernés) → Vercel **redéploie automatiquement** en ~1 minute.

---

## Honnêteté sur l'offre gratuite (important pour la suite)

- **Vercel Hobby (gratuit)** = usage **personnel / non commercial**. Tant que le site
  est une démo ou un projet d'étude : parfait. Le jour où Locho encaissera
  réellement des clients → il faudra **Vercel Pro (20 $/mois)**, ou héberger sur un
  serveur : les fichiers `Dockerfile`, `docker-compose.yml`, `Caddyfile` sont déjà
  dans le projet (voir « Option B » plus bas).
- **Neon (gratuit)** : 1 Go de stockage + 100 h de calcul/mois — largement assez pour
  des centaines de commandes. Il se met en veille après 5 min d'inactivité
  (d'où les 2–5 s de réveil).
- **Paiement, e-mails, SMS** : la V1 simule le prestataire de paiement et
  l'envoi d'e-mails (les notifications s'affichent dans l'application). À brancher
  avant une vraie ouverture (cf. checklist de l'ancien guide, § Paiements).
- **Surveillance** : `https://VOTRE-URL/api/health` → vous pouvez en faire votre
  page « le site est-il vivant ».

## 🩹 Dépannage

| Symptom | Cause | Solution |
|---|---|---|
| *Build failed* pendant le déploiement | variable manquante | Vercel → Settings → Environment Variables : vérifiez les 4 lignes → redeploy |
| Page d'erreur 500 | `DATABASE_URL` mal collé | recopiez-le depuis Neon (Pooled + SSL Require) → redeploy |
| *does not exist* en base | installation pas encore déclenchée | rechargez simplement la page |
| Connexion Neon refusée | mauvaise URL | prenez bien **Pooled connection string**, avec `?sslmode=require` |
| Vous avez cliqué Deploy trop tôt | vars ajoutées après le build | ça arrive ! Ajoutez les vars → **Deployments → Redeploy** |

---

## Option B — Plus tard : son propre serveur (fichiers déjà fournis)

Quand (et si) vous voudrez un domaine `.fr` chez OVH et un contrôle total : les
fichiers `Dockerfile`, `docker-compose.yml` et `Caddyfile` sont dans le projet —
sur un serveur Ubuntu : `docker compose up -d --build` suffit à lancer l'application,
PostgreSQL et le HTTPS automatique. Détails dans l'historique du projet.
