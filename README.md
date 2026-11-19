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

Un **mode démonstration** (bouton sur l'écran de connexion) charge deux taxis et six mois
d'activité fictive, sur l'appareil uniquement.

---

## 2. Mise en ligne pas à pas

Il vous faut trois comptes gratuits : **GitHub**, **Supabase**, **Netlify**.

### Étape 1 — Créer la base de données (Supabase)

1. Sur [supabase.com](https://supabase.com) → **New project**. Choisissez une région proche
   (ex. *West EU – Paris* ou *Frankfurt*), notez le mot de passe de la base.
2. Menu **SQL Editor** → **New query** → collez **tout** le contenu du fichier
   `supabase/migrations/20261119000000_schema_initial.sql` → **Run**.
   Le message *Success. No rows returned* confirme la création des tables.
3. Menu **Project Settings → API** : copiez
   - **Project URL** (ex. `https://abcdxyz.supabase.co`)
   - la clé **anon public**

   Ne copiez jamais la clé `service_role` dans Netlify ou dans le code.

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
2. Avant de déployer, ouvrez **Environment variables** (ou après : *Site configuration →
   Environment variables*) et ajoutez :

   | Variable | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | la Project URL de l'étape 1 |
   | `VITE_SUPABASE_ANON_KEY` | la clé anon public de l'étape 1 |

3. **Deploy**. Après 1 à 2 minutes, le site est en ligne à une adresse du type
   `https://le-passeur-taxi-plus.netlify.app` (renommable dans *Site configuration*).
   Si vous avez ajouté les variables après le premier déploiement : **Deploys → Trigger deploy**.

### Étape 4 — Relier Supabase à l'adresse du site

Supabase → **Authentication → URL Configuration** :
- **Site URL** : l'adresse Netlify
- **Redirect URLs** : la même adresse suivie de `/**`

(Facultatif) *Authentication → Providers → Email* : désactivez **Confirm email** si vous
ne voulez pas valider l'adresse par lien à l'inscription.

### Étape 5 — Installer sur le téléphone

- **Android** : ouvrez l'adresse dans **Chrome** → menu ⋮ → **Installer l'application**
  (ou le bouton *Installer* dans *Paramètres*).
- **iPhone** : **Safari** → Partager → **Sur l'écran d'accueil**.

Créez votre compte, ajoutez votre taxi : c'est prêt. Pour un second téléphone (gérant,
associé), connectez-vous avec le même compte : les données se synchronisent.

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

Hypothèses par défaut (modifiables) : investissement 3 000 000 FCFA, versement
20 000 FCFA × 26 jours, assurance 250 000 FCFA/an, visite technique 25 000 FCFA/semestre,
taxe municipale 5 000 FCFA/mois, vidange 25 000 FCFA/mois, amortissement sur 5 ans avec
600 000 FCFA de valeur de revente. **Vérifiez ces montants localement** : ils servent de
point de départ, pas de référence officielle.

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
npm run build && npx vite preview --port 4173
python3 tests/e2e.py           # parcours complet dans Chromium (Playwright)
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
