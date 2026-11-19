// Validation du schéma Supabase dans un PostgreSQL embarqué (PGlite) : idempotence, contraintes,
// sécurité par ligne entre deux comptes, mécanique de synchronisation. Lancer : npm run test:sql
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
const sql = fs.readFileSync(process.argv[2], "utf8");
try { await db.exec(sql); } catch (e) { console.log("ERREUR SQL:", e.message, e.position); process.exit(1); }
await db.exec(sql); // ré-exécution : le script doit être idempotent
console.log("schéma appliqué deux fois sans erreur");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"nom":"hks"}'), ('${B}', '{}')`);
console.log("profils auto :", (await db.query("select count(*)::int n from public.profils")).rows[0].n);
const as = async (uid, q) => { await db.exec(`reset role; set test.uid = '${uid}'; set role authenticated;`); return db.query(q); };
let r = await as(A, `insert into taxis (nom, mode) values ('Taxi A1','versement') returning id`);
const taxiA = r.rows[0].id;
await as(A, `insert into investissements (taxi_id, libelle, montant) values ('${taxiA}','Achat',2400000)`);
await as(A, `insert into journees (taxi_id, date, recette) values ('${taxiA}','2026-11-18',20000)`);
await as(A, `insert into chauffeurs (nom, remuneration, pourcentage) values ('Prosper','pourcentage',30)`);
const ch = (await as(A, `insert into charges (taxi_id, libelle, montant, frequence) values ('${taxiA}','Assurance',250000,'annuel') returning id`)).rows[0].id;
await as(A, `insert into depenses (taxi_id, type, libelle, montant, charge_id, echeance) values ('${taxiA}','fixe','Assurance',250000,'${ch}','2026-11-01')`);
try { await as(A, `insert into depenses (taxi_id, type, libelle, montant, charge_id, echeance) values ('${taxiA}','fixe','Assurance',250000,'${ch}','2026-11-01')`); console.log("FAIL doublon accepté"); }
catch { console.log("ok  double paiement d'une même échéance refusé"); }
try { await as(A, `insert into journees (taxi_id, date, recette) values ('${taxiA}','2026-11-18',5000)`); console.log("FAIL"); }
catch { console.log("ok  deux saisies le même jour pour un taxi refusées"); }
try { await as(A, `insert into salaires (chauffeur_id, periode, montant) select id, '2026-11-15', 1000 from chauffeurs`); console.log("FAIL"); }
catch { console.log("ok  période de salaire hors début de mois refusée"); }
// isolation
r = await as(B, `select count(*)::int n from taxis`); console.log(r.rows[0].n === 0 ? "ok  B ne voit pas les taxis de A" : "FAIL fuite");
r = await as(B, `select count(*)::int n from journees`); console.log(r.rows[0].n === 0 ? "ok  B ne voit pas les journées de A" : "FAIL fuite");
try { await as(B, `insert into journees (taxi_id, date, recette) values ('${taxiA}','2026-11-19',1)`); console.log("FAIL B écrit chez A"); }
catch (e) { console.log("ok  B ne peut pas écrire sur le taxi de A"); }
try { await as(B, `insert into taxis (owner_id, nom) values ('${A}','pirate')`); console.log("FAIL usurpation"); }
catch { console.log("ok  B ne peut pas créer une ligne au nom de A"); }
r = await as(B, `update taxis set nom='x' where id='${taxiA}' returning id`); console.log(r.rows.length === 0 ? "ok  B ne peut pas modifier le taxi de A" : "FAIL");
await db.exec(`reset role; set test.uid = ''; set role anon;`);
try { await db.query(`select * from taxis`); console.log("FAIL anon lit"); } catch { console.log("ok  utilisateur non connecté : accès refusé"); }
await db.exec(`reset role`);
r = await as(A, `delete from taxis where id='${taxiA}'`);
r = await as(A, `select (select count(*) from journees)::int j, (select count(*) from investissements)::int i, (select count(*) from depenses)::int d`);
console.log("cascade après suppression du taxi :", r.rows[0]);
// synchronisation : upsert par identifiant + horodatage serveur
const tA2 = (await as(A, `insert into taxis (nom) values ('Taxi A2') returning id`)).rows[0].id;
const jid = "33333333-3333-3333-3333-333333333333";
const u1 = (await as(A, `insert into journees (id, taxi_id, date, recette) values ('${jid}','${tA2}','2026-11-19',15000)
  on conflict (id) do update set recette = excluded.recette returning updated_at`)).rows[0].updated_at;
const u2 = (await as(A, `insert into journees (id, taxi_id, date, recette) values ('${jid}','${tA2}','2026-11-19',21000)
  on conflict (id) do update set recette = excluded.recette returning updated_at, recette`)).rows[0];
console.log(u2.recette == 21000 && new Date(u2.updated_at) > new Date(u1) ? "ok  upsert hors ligne + horodatage serveur croissant" : "FAIL upsert");
await as(A, `update journees set deleted_at = now() where id='${jid}'`);
try { await as(A, `insert into journees (taxi_id, date, recette) values ('${tA2}','2026-11-19',9000)`); console.log("ok  une journée supprimée libère la date"); }
catch { console.log("FAIL date bloquée après suppression logique"); }
// chauffeur d'un autre compte
const chA = (await as(A, `insert into chauffeurs (nom) values ('X') returning id`)).rows[0].id;
const tB = (await as(B, `insert into taxis (nom) values ('Taxi B') returning id`)).rows[0].id;
try { await as(B, `update taxis set chauffeur_id='${chA}' where id='${tB}'`); console.log("FAIL chauffeur étranger accepté"); }
catch { console.log("ok  impossible d'affecter le chauffeur d'un autre compte"); }
