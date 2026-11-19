# LE PASSEUR TAXI+

**Gérer · Suivre · Rentabiliser** — application de gestion de taxis : recettes, dépenses,
chauffeurs, salaires, amortissement et retour sur investissement, en FCFA.

Application web installable sur Android et iPhone (PWA), **utilisable sans Internet**,
synchronisée entre plusieurs téléphones via Supabase, déployée automatiquement par
Netlify à partir de GitHub. Tout fonctionne sur les offres gratuites.

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Mise en ligne pas à pas](#2-mise-en-ligne-pas-à-pas) (≈ 30 minutes, sans programmer)
3. [Rappel de 20 h (notifications push)](#3-rappel-de-20-h-notifications-push)
4. [Mises à jour](#4-mises-à-jour)
5. [Fonctionnement hors ligne](#5-fonctionnement-hors-ligne)
6. [Les calculs](#6-les-calculs)
7. [Pour les développeurs](#7-pour-les-développeurs)
8. [Limites à connaître](#8-limites-à-connaître)

---

## 1. Fonctionnalités

| Écran | Ce qu'il fait |
|---|---|
| **Tableau de bord** | Entrées, sorties et solde de la période ; évolution mensuelle ; détail des dépenses par catégorie, dépliable jusqu'à chaque opération ; retour sur investissement avec date projetée ; échéances ; fonds d'imprévus ; classement des taxis |
| **Saisie du jour** | Une carte par taxi : recette (montants rapides), carburant, entretien, statut travail / repos / panne en un toucher |
| **Taxis** | Ajout par assistant en 4 étapes (investissement pré-rempli à ~3 000 000 FCFA), fiche par taxi : courbe de remboursement, calendrier coloré, investissement et tableau d'amortissement, charges, réglages, archivage |
| **Dépenses** | Échéancier des charges récurrentes avec retards, historique filtrable, charges récurrentes, fonds d'imprévus |
| **Chauffeurs & salaires** | Quatre modes de rémunération (versement, salaire fixe, par jour, pourcentage) ; dû calculé depuis le journal ; avances, primes, retenues ; reste à payer |
| **Rapports** | Compte de résultat mensuel, prévu contre réel, simulateur, exports CSV pour Excel, rapport PDF imprimable, sauvegarde JSON |
| **Paramètres** | Rappel de 20 h, état de la synchronisation, thème clair / sombre, restauration, compte |

Trois modes d'exploitation par taxi : **versement journalier**, **exploitation directe**
(chauffeur salarié) et **je conduis moi-même** (avec suivi des prélèvements personnels).

**Accès par compte obligatoire** : à l'ouverture, l'application affiche l'écran de connexion
(onglets *Se connecter* / *Créer un compte*, e-mail + mot de passe, sans vérification). Une fois
connecté, on le reste sur l'appareil — même hors ligne — jusqu'à la déconnexion volontaire.
Un mode démonstration existe uniquement dans la version de développement sans serveur.

---

## 2. Mise en ligne pas à pas

Il vous faut trois comptes gratuits : **GitHub**, **Supabase**, **Netlify**.

### Étape 1 — Créer la base de données (Supabase)

> Votre projet est déjà branché : l'adresse `https://zsnmuyltwdbrbrjlavvz.supabase.co` et la clé
> publique sont dans `.env.production`, lu automatiquement à chaque build Netlify. Il reste
> seulement à créer les tables (point 2) dans **ce** projet.

1. (Projet déjà créé.) Pour un autre projet : [supabase.com](https://supabase.com) → **New project**,
   région proche (*Paris* ou *Frankfurt*), puis remplacez les deux valeurs de `.env.production`.
2. Menu **SQL Editor** → **New query** → collez **tout** le contenu du fichier
   `supabase/migrations/20261119000000_schema_initial.sql` → **Run**.
   Le message *Success. No rows returned* confirme la création des tables.
3. La clé utilisée est la clé **publishable** (`sb_publishable_…`) : elle est publique par nature,
   la sécurité repose sur les règles RLS créées par le script. Ne copiez **jamais** la clé
   secrète (`sb_secret_…` / `service_role`) dans Netlify ou dans le code.

### Étape 2 — Déposer le code sur GitHub

1. Sur [github.com](https://github.com) → **New repository** → nom `le-passeur-taxi-plus`,
   visibilité **Private** → **Create repository**.
2. Cliquez **uploading an existing file**, glissez **le contenu** du dossier décompressé
   (pas le dossier lui-même ; sans `node_modules`), puis **Commit changes**.

   Ou en ligne de commande :
   ```bash
   cd le-passeur-taxi-plus
   git init && git add . && git commit -m "LE PASSEUR TAXI+ v2"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/le-passeur-taxi-plus.git
   git push -u origin main
   ```

### Étape 3 — Publier avec Netlify

1. Sur [netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**
   → choisissez le dépôt. Les réglages de build sont lus dans `netlify.toml` : ne changez rien.
2. Aucune variable à saisir : les clés sont dans `.env.production`. (Une variable définie dans
   Netlify, si vous en ajoutez une, est prioritaire.)
3. **Deploy**. Après 1 à 2 minutes, le site est en ligne à une adresse du type
   `https://le-passeur-taxi-plus.netlify.app` (renommable dans *Site configuration*).
   Si vous avez ajouté les variables après le premier déploiement : **Deploys → Trigger deploy**.

### Étape 4 — Comptes sans vérification d'e-mail

L'inscription et la connexion se font par **e-mail + mot de passe, sans e-mail de vérification**.
Le script SQL confirme automatiquement chaque compte à sa création. Faites en plus ce réglage,
qui évite la limite d'envoi d'e-mails de l'offre gratuite (quelques inscriptions par heure) :

Supabase → **Authentication → Sign In / Providers → Email** → désactivez **Confirm email** → *Save*.

Puis **Authentication → URL Configuration** → **Site URL** : l'adresse Netlify.

### Étape 5 — Installer sur le téléphone

- **Android** : ouvrez l'adresse dans **Chrome** → menu ⋮ → **Installer l'application**
  (ou le bouton *Installer* dans *Paramètres*).
- **iPhone** : **Safari** → Partager → **Sur l'écran d'accueil**.

Créez votre compte, ajoutez votre taxi : c'est prêt.

### Un compte, plusieurs appareils

Connectez-vous avec le **même e-mail et le même mot de passe** sur un autre téléphone, une
tablette ou un ordinateur : au premier lancement, l'application rapatrie tout le compte
**avant** d'afficher quoi que ce soit, puis reste synchronisée en continu.

| Ce qui est partagé entre appareils | |
|---|---|
| Taxis, investissements, journées, dépenses, charges, échéances payées | ✓ |
| Chauffeurs, salaires, avances, primes, retenues | ✓ |
| Nom de l'entreprise, responsable, téléphone, ville | ✓ |
| Thème clair / sombre | ✓ |
| Rappel de 20 h activé ou non | ✓ (chaque appareil doit autoriser les notifications une fois — un bandeau le propose) |
| Notifications lues ou supprimées, alertes masquées | ✓ |

Une modification faite sur un appareil apparaît sur les autres **en quelques secondes**
(temps réel Supabase), même sans recharger la page.

---

## 3. Rappel de 20 h (notifications push)

Sans configuration supplémentaire, l'application vous rappelle à 20 h si elle est ouverte
ou en arrière-plan récent, et affiche le rappel dans la cloche à la prochaine ouverture.
Pour recevoir la notification **même application fermée**, activez le push serveur :

1. **Clés VAPID** (sur un ordinateur avec Node.js) :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Netlify** → ajoutez `VITE_VAPID_PUBLIC_KEY` = la clé **publique**, puis redéployez.
3. **Supabase → Edge Functions → Deploy a new function → Via editor**, nom
   `rappel-quotidien`, collez `supabase/functions/rappel-quotidien/index.ts`, déployez.
   Dans les détails de la fonction, désactivez **Enforce JWT verification**.

   Ou avec la CLI : `supabase functions deploy rappel-quotidien --no-verify-jwt`
4. **Edge Functions → Secrets** : ajoutez
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ex. `mailto:vous@exemple.com`)
   et `CRON_SECRET` (une longue chaîne aléatoire de votre choix).
5. **SQL Editor** : collez `supabase/cron_rappel.sql`, remplacez `<REF-PROJET>` et
   `<CRON_SECRET>`, **Run**.
6. Dans l'application : **Paramètres → Rappel quotidien à 20 h** → autorisez les notifications.

La fonction tourne chaque heure ; elle n'envoie qu'aux appareils dont l'heure locale est
20 h, **seulement si une journée manque**, une seule fois par jour. Les notifications se
suppriment d'un glissement sur le téléphone, et une à une ou toutes ensemble dans la cloche.

Test manuel : appelez la fonction avec `?force=1` et l'en-tête `x-cron-secret`.

---

## 4. Mises à jour

Modifiez le code sur GitHub (ou poussez un commit) : Netlify reconstruit le site, et
chaque téléphone installe la nouvelle version **tout seul** à l'ouverture suivante ou
dans les 30 minutes. L'activation attend qu'aucune saisie ne soit ouverte, puis un message
« Application mise à jour » s'affiche. Pour changer le numéro affiché, modifiez `version`
dans `package.json`.

---

## 5. Fonctionnement hors ligne

```
 Saisie ─▶ mémoire + IndexedDB (immédiat) ─▶ file d'envoi
                                               │  réseau disponible ?
                                               ▼  (ouverture, retour du réseau, toutes les 90 s)
                                   Supabase ◀─ envoi ─┘
                                       │
                                       └─▶ rapatriement des changements faits ailleurs
```

- Chaque saisie est **enregistrée sur le téléphone avant tout envoi** : couper le réseau,
  fermer l'application ou redémarrer le téléphone ne perd rien.
- La file d'envoi est téléversée au retour de la connexion ou à la prochaine ouverture.
- Plusieurs modifications d'une même ligne hors ligne ne font qu'un envoi (la dernière).
- Une même journée saisie sur deux téléphones est **fusionnée** (identifiant dérivé du
  taxi et de la date), sans doublon.
- Les suppressions se propagent aux autres appareils (suppression logique).
- Une ligne refusée par le serveur est mise de côté avec sa raison (*Paramètres →
  Synchronisation*) sans bloquer les autres.
- La pastille en haut de l'écran indique : *À jour*, *N en attente*, *Hors ligne*.

La première connexion à un compte nécessite Internet ; ensuite tout fonctionne hors ligne.

---

## 6. Les calculs

| Indicateur | Définition |
|---|---|
| Entrées | Recettes des journées (versements ou recettes brutes) |
| Sorties | Carburant, entretien, frais du journal + charges fixes payées + imprévus + entretien hors journal + salaires, avances et primes versés |
| Solde (marge) | Entrées − sorties : l'argent réellement gagné |
| Amortissement | (Investissement − valeur résiduelle) ÷ durée, réparti au jour près |
| Résultat net | Solde − amortissement |
| Récupération | Somme des soldes depuis la mise en service ÷ investissement |
| Date de retour | Reste à récupérer ÷ solde moyen des 60 derniers jours |
| Fonds d'imprévus | Taux × recettes (10 % par défaut) − imprévus payés |
| Salaire dû | Fixe ; ou jours travaillés × montant ; ou % des recettes du chauffeur ; moins les retenues. Reste = dû − salaires − avances |
| Prélèvement | Argent retiré par le propriétaire-conducteur : ni charge ni recette, il réduit la trésorerie |

### Frais de démarrage par défaut (Brazzaville, modifiables)

| Poste | Montant | Traitement |
|---|---|---|
| Achat du véhicule (occasion type Corolla) | 2 300 000 | amortissable (marché : 1,5 – 3 M) |
| Peinture complète vert / blanc | 200 000 | amortissable (100 000 – 300 000) |
| Carte grise définitive · certificat de vente · numérotage taxi | 30 000 · 20 000 · 20 000 | amortissable |
| Réservation de plaque | 100 000 | amortissable — à retirer si le véhicule a déjà des plaques |
| Révision mécanique · équipements | 80 000 · 30 000 | amortissable |
| Premier plein (50 L × 775 FCFA) | 38 750 | consommé, non amortissable |
| Nettoyage initial | 1 000 | consommé, non amortissable |
| **Investissement à rembourser** | **2 819 750** | |
| Assurance RC usage taxi | 100 000 / an | 1re échéance payée au démarrage (60 000 – 120 000) |
| Patente | 36 500 / an | idem |
| Droits d'auteur (BCDA) | 10 000 / an | idem |
| Taxe de roulage | 10 000 / an | idem — **exonération des taxis à vérifier en mairie** (loi de finances 2026) |
| Droit de stationnement | 5 000 / an | idem |
| Visite technique | 25 000 / semestre | idem |
| **Trésorerie nécessaire au démarrage** | **3 006 250** | |

Ensuite : vidange 20 000 FCFA/mois (échéancier), entretien courant + lavage ≈ 35 000 FCFA/mois
(prévisionnel), carburant 10 000 – 15 000 FCFA/jour en exploitation directe, objectif de
versement 20 000 FCFA × 26 jours, amortissement sur 5 ans avec 600 000 FCFA de valeur de revente.

Pourquoi l'assurance et les taxes ne sont pas dans l'investissement : elles reviennent chaque
année. Les compter dans l'investissement **et** dans les charges ferait payer deux fois la
première année dans le calcul du retour. Elles apparaissent donc comme charges payées le jour
de la mise en service, et dans le « budget de démarrage ».

Non intégrés : l'**Impôt Global Forfaitaire** (proportionnel au chiffre d'affaires, la patente
s'en déduit) — à ajouter comme charge une fois son montant connu ; l'**autorisation de transport
public (ATP)**, dont les taxis sont exemptés.

**Vérifiez ces montants localement** : ils servent de point de départ, pas de référence officielle.

---

## 7. Pour les développeurs

**Pile** : React 19 · TypeScript · Vite 8 · vite-plugin-pwa (Workbox) · Recharts ·
Supabase (PostgreSQL, Auth, RLS, Edge Functions) · IndexedDB (`idb`).

```bash
npm install
cp .env.example .env.local     # renseigner l'URL et la clé Supabase (ou laisser vide : mode local)
npm run dev                    # http://localhost:5173
npm test                       # moteur financier + synchronisation hors ligne (Vitest)
npm run test:sql               # schéma, contraintes et sécurité RLS (PostgreSQL embarqué)
npm run build:local && npx vite preview --port 4173   # version sans serveur pour les tests
python3 tests/e2e.py           # parcours complet dans Chromium (Playwright)
npm run build && npx vite preview --port 4174
python3 tests/e2e_auth.py      # accès par compte (connexion obligatoire, inscription, session conservée)
```

```
src/
  lib/finance.ts       moteur financier pur (testé)
  lib/store.ts         magasin hors ligne + synchronisation
  lib/notifications.ts rappel 20 h, push, alertes
  lib/session.tsx      compte, mode local, démonstration
  pages/               écrans
  components/          interface, formulaires, graphiques
  sw.ts                service worker (cache, push, clic)
supabase/
  migrations/          schéma SQL complet
  functions/           fonction de rappel quotidien
  cron_rappel.sql      planification horaire
tools/make_brand.py    régénère icônes et logos depuis le logo officiel
```

Sans variables Supabase, l'application tourne en **mode local** (un seul appareil,
aucune synchronisation) : pratique pour tester.

---

## 8. Limites à connaître

- **Supabase gratuit met le projet en pause après 7 jours sans aucune activité.** Les
  données sont conservées ; l'application continue de fonctionner hors ligne et se
  resynchronise après réactivation (bouton *Restore* dans Supabase). Une utilisation
  quotidienne normale évite la pause.
- Conflits : si deux téléphones modifient la **même** ligne hors ligne, la dernière
  synchronisée l'emporte.
- Push sur iPhone : iOS 16.4 minimum, application ajoutée à l'écran d'accueil.
- Le rappel serveur part à l'heure pile, avec quelques minutes de décalage possibles.
- Un compte = un propriétaire. Le partage avec des rôles distincts (gérant en lecture
  seule, chauffeur qui saisit) n'est pas inclus.
