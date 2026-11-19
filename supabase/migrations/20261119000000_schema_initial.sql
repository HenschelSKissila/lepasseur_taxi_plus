-- =====================================================================
-- LE PASSEUR TAXI+ — schéma de la base de données (Supabase / PostgreSQL 15+)
--
-- À exécuter une seule fois : Supabase → SQL Editor → coller ce fichier → Run.
-- Le script est ré-exécutable sans danger (idempotent).
--
-- Principes :
--   • Montants en FCFA entiers (bigint).
--   • Chaque ligne appartient à un compte (owner_id) ; la sécurité par ligne
--     (RLS) empêche tout accès aux données d'un autre compte.
--   • Synchronisation hors ligne : les identifiants sont générés par
--     l'application, updated_at est posé par le serveur et sert de curseur,
--     et les suppressions sont logiques (deleted_at) pour se propager
--     aux autres appareils.
-- =====================================================================

-- ---------------------------------------------------------------- types
do $$ begin create type mode_exploitation as enum ('versement', 'direct', 'perso');
exception when duplicate_object then null; end $$;
do $$ begin create type statut_journee as enum ('travail', 'repos', 'panne');
exception when duplicate_object then null; end $$;
do $$ begin create type type_depense as enum ('fixe', 'imprevu', 'entretien', 'autre');
exception when duplicate_object then null; end $$;
do $$ begin create type frequence_charge as enum ('mensuel', 'trimestriel', 'semestriel', 'annuel', 'unique');
exception when duplicate_object then null; end $$;
do $$ begin create type type_remuneration as enum ('versement', 'salaire_fixe', 'journalier', 'pourcentage');
exception when duplicate_object then null; end $$;
do $$ begin create type type_paiement_salaire as enum ('salaire', 'avance', 'prime', 'retenue');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ profils
create table if not exists public.profils (
  id            uuid primary key references auth.users(id) on delete cascade,
  entreprise    text not null default 'LE PASSEUR TAXI+',
  responsable   text,
  telephone     text,
  ville         text default 'Brazzaville',
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- --------------------------------------------- paramètres du compte (synchronisés)
-- Une ligne par compte (id = identifiant du compte) : entreprise, thème, rappel, alertes masquées.
-- Tous les appareils connectés au même compte partagent ces réglages.
create table if not exists public.parametres (
  id                uuid primary key,
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entreprise        text not null default 'LE PASSEUR TAXI+',
  responsable       text,
  telephone         text,
  ville             text default 'Brazzaville',
  theme             text not null default 'auto' check (theme in ('auto', 'light', 'dark')),
  rappel_actif      boolean not null default false,
  heure_rappel      smallint not null default 20 check (heure_rappel between 0 and 23),
  alertes_masquees  jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  check (id = owner_id)
);

-- ---------------------------------------------------------- chauffeurs
create table if not exists public.chauffeurs (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null check (length(trim(nom)) > 0),
  telephone      text,
  numero_permis  text,
  date_embauche  date,
  remuneration   type_remuneration not null default 'versement',
  montant        bigint not null default 0 check (montant >= 0),   -- salaire mensuel ou montant par jour
  pourcentage    numeric(5,2) not null default 0 check (pourcentage between 0 and 100),
  actif          boolean not null default true,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- -------------------------------------------------------------- taxis
create table if not exists public.taxis (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom                    text not null check (length(trim(nom)) > 0),
  immatriculation        text,
  modele                 text,
  annee                  smallint check (annee between 1970 and 2100),
  date_mise_service      date not null default current_date,
  km_initial             integer not null default 0 check (km_initial >= 0),
  mode                   mode_exploitation not null default 'versement',
  chauffeur_id           uuid references public.chauffeurs(id) on delete set null,
  objectif_recette_jour  bigint not null default 20000 check (objectif_recette_jour >= 0),
  jours_par_mois         smallint not null default 26 check (jours_par_mois between 1 and 31),
  carburant_jour_prevu   bigint not null default 0 check (carburant_jour_prevu >= 0),
  entretien_mois_prevu   bigint not null default 30000 check (entretien_mois_prevu >= 0),
  duree_amortissement    smallint not null default 5 check (duree_amortissement between 1 and 20),
  valeur_residuelle      bigint not null default 600000 check (valeur_residuelle >= 0),
  taux_imprevus          numeric(4,3) not null default 0.10 check (taux_imprevus between 0 and 0.5),
  actif                  boolean not null default true,
  note                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

-- ---------------------------------------------- investissement initial
create table if not exists public.investissements (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taxi_id     uuid not null references public.taxis(id) on delete cascade,
  libelle     text not null,
  montant     bigint not null check (montant >= 0),
  ordre       smallint not null default 0,
  amortissable boolean not null default true,      -- false : frais de démarrage consommés (plein, nettoyage)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
-- Mise à niveau si une version antérieure du script a déjà été exécutée
alter table public.investissements add column if not exists amortissable boolean not null default true;

-- ------------------------------------------------- journées d'exploitation
-- L'identifiant d'une journée est dérivé de (taxi, date) côté application :
-- deux téléphones hors ligne qui saisissent le même jour écrivent la même ligne.
create table if not exists public.journees (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taxi_id       uuid not null references public.taxis(id) on delete cascade,
  chauffeur_id  uuid references public.chauffeurs(id) on delete set null,
  date          date not null,
  statut        statut_journee not null default 'travail',
  recette       bigint not null default 0 check (recette >= 0),
  carburant     bigint not null default 0 check (carburant >= 0),
  entretien     bigint not null default 0 check (entretien >= 0),
  autres        bigint not null default 0 check (autres >= 0),
  prelevement   bigint not null default 0 check (prelevement >= 0),  -- retrait personnel du propriétaire
  km            integer check (km >= 0),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index if not exists journees_taxi_date on public.journees (taxi_id, date) where deleted_at is null;

-- ---------------------------------------------- charges récurrentes
create table if not exists public.charges (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taxi_id     uuid references public.taxis(id) on delete cascade,     -- null = charge commune à la flotte
  libelle     text not null,
  categorie   text not null default 'Autre',
  montant     bigint not null check (montant > 0),
  frequence   frequence_charge not null default 'annuel',
  date_debut  date not null default current_date,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ------------------------------------------------------------- dépenses
create table if not exists public.depenses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taxi_id     uuid references public.taxis(id) on delete cascade,     -- null = dépense commune
  date        date not null default current_date,
  type        type_depense not null default 'autre',
  categorie   text not null default 'Autre',
  libelle     text not null,
  montant     bigint not null check (montant > 0),
  charge_id   uuid references public.charges(id) on delete set null,
  echeance    date,                                                  -- échéance réglée par ce paiement
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index if not exists depenses_echeance_unique on public.depenses (charge_id, echeance)
  where charge_id is not null and echeance is not null and deleted_at is null;

-- ------------------------------------------------- salaires & avances
create table if not exists public.salaires (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chauffeur_id   uuid not null references public.chauffeurs(id) on delete cascade,
  taxi_id        uuid references public.taxis(id) on delete set null,
  periode        date not null,                                   -- premier jour du mois concerné
  type           type_paiement_salaire not null default 'salaire',
  montant        bigint not null check (montant > 0),
  date_paiement  date not null default current_date,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  check (periode = date_trunc('month', periode)::date)
);

-- ------------------------------------------------- notifications in-app
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cle         text not null,                  -- évite les doublons (ex. rappel-2026-11-19)
  titre       text not null,
  corps       text,
  lien        text,
  lu          boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (owner_id, cle)
);

-- ------------------------------------------- abonnements aux notifications push
create table if not exists public.push_abonnements (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  heure_rappel  smallint not null default 20 check (heure_rappel between 0 and 23),
  fuseau        text not null default 'Africa/Brazzaville',
  appareil      text,
  actif         boolean not null default true,
  dernier_envoi date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- index
do $$
declare t text;
begin
  foreach t in array array['parametres','chauffeurs','taxis','investissements','journees','charges','depenses','salaires','notifications'] loop
    execute format('create index if not exists %I on public.%I (owner_id, updated_at)', t || '_sync', t);
  end loop;
end $$;
create index if not exists journees_owner_date on public.journees (owner_id, date);

-- ------------------------------------------------- fonctions & déclencheurs
-- Horodatage serveur : sert de curseur de synchronisation (indépendant de l'horloge du téléphone).
create or replace function public.maj_horodatage() returns trigger
language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;

-- Une référence (taxi, chauffeur, charge) doit appartenir au même compte.
create or replace function public.verifier_proprietaire() returns trigger
language plpgsql security invoker as $$
declare r jsonb := to_jsonb(new);
begin
  if r->>'taxi_id' is not null and not exists
     (select 1 from public.taxis t where t.id = (r->>'taxi_id')::uuid and t.owner_id = new.owner_id) then
    raise exception 'Taxi inconnu pour ce compte';
  end if;
  if r->>'chauffeur_id' is not null and not exists
     (select 1 from public.chauffeurs c where c.id = (r->>'chauffeur_id')::uuid and c.owner_id = new.owner_id) then
    raise exception 'Chauffeur inconnu pour ce compte';
  end if;
  if r->>'charge_id' is not null and not exists
     (select 1 from public.charges c where c.id = (r->>'charge_id')::uuid and c.owner_id = new.owner_id) then
    raise exception 'Charge inconnue pour ce compte';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profils','parametres','chauffeurs','taxis','investissements','journees','charges','depenses',
                           'salaires','notifications','push_abonnements'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_horodatage', t);
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.maj_horodatage()', t || '_horodatage', t);
  end loop;
  foreach t in array array['taxis','investissements','journees','charges','depenses','salaires'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_proprio', t);
    execute format('create trigger %I before insert or update on public.%I
                    for each row execute function public.verifier_proprietaire()', t || '_proprio', t);
  end loop;
end $$;

-- Profil créé automatiquement à l'inscription.
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, responsable) values (new.id, new.raw_user_meta_data->>'nom')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists a_inscription on auth.users;
create trigger a_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- Inscription par e-mail + mot de passe SANS vérification : le compte est confirmé à sa création.
-- (Complément du réglage Authentication → Providers → Email → « Confirm email » désactivé.)
create or replace function public.confirmer_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at := now(); end if;
  return new;
end $$;
drop trigger if exists confirmation_auto on auth.users;
create trigger confirmation_auto before insert on auth.users
  for each row execute function public.confirmer_email();

-- Suppression du compte par l'utilisateur lui-même (exigée par Google Play pour les applications avec compte).
-- Efface le compte d'authentification ; toutes les données suivent par « on delete cascade ».
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ===================================================== sécurité (RLS)
do $$
declare t text;
begin
  foreach t in array array['profils','parametres','chauffeurs','taxis','investissements','journees','charges','depenses',
                           'salaires','notifications','push_abonnements'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['parametres','chauffeurs','taxis','investissements','journees','charges','depenses',
                           'salaires','notifications','push_abonnements'] loop
    execute format('drop policy if exists "donnees du proprietaire" on public.%I', t);
    execute format('create policy "donnees du proprietaire" on public.%I for all to authenticated
                    using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;
drop policy if exists "profil personnel" on public.profils;
create policy "profil personnel" on public.profils for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ============================================ temps réel (synchronisation instantanée)
-- Les autres appareils du compte sont prévenus dès qu'une ligne change (la RLS s'applique).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['parametres','chauffeurs','taxis','investissements','journees','charges','depenses','salaires','notifications'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Le rôle anonyme n'a accès à rien ; les comptes connectés passent par la RLS.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
