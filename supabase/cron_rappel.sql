-- =====================================================================
-- Planification du rappel de 20 h (à exécuter APRÈS avoir déployé la fonction
-- « rappel-quotidien » et défini ses secrets). SQL Editor → coller → Run.
--
-- Remplacez les deux valeurs entre chevrons :
--   <REF-PROJET>   identifiant du projet (dans l'URL : https://<REF-PROJET>.supabase.co)
--   <CRON_SECRET>  la même chaîne que le secret CRON_SECRET de la fonction
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supprime une éventuelle planification précédente
select cron.unschedule(jobid) from cron.job where jobname = 'rappel-quotidien';

-- Toutes les heures pile : la fonction n'envoie qu'aux appareils dont l'heure
-- locale est l'heure de rappel (20 h), et seulement si une journée manque.
select cron.schedule(
  'rappel-quotidien',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<REF-PROJET>.supabase.co/functions/v1/rappel-quotidien',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Vérification : select * from cron.job_run_details order by start_time desc limit 5;
