-- Persiste los GRANTs aplicados manualmente en producción.
-- Sin estos, las RLS policies no se evalúan: Postgres rechaza queries
-- con "permission denied" antes de que RLS pueda intervenir.
-- NO re-aplicar a Cloud si ya se aplicó directamente.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

grant usage on schema public to anon;
