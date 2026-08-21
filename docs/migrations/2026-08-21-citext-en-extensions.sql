-- =============================================================
--  Migración: mover citext/pg_trgm a extensions + calificar
--  crear_perfil() sin depender del search_path ambiental
--  2026-08-21 (sigue a 2026-08-21-crear-perfil-defensivo.sql)
-- =============================================================
--
-- Causa real confirmada en los logs de Postgres:
--   42704: type "citext" does not exist
--   25P02: current transaction is aborted, ...
--
-- docs/schema.sql instala citext (y pg_trgm) sin declarar esquema,
-- así que quedan en `public`. El trigger crear_perfil() corre en el
-- contexto de la transacción de auth.users, donde `public` no está
-- en el search_path a propósito (es el mismo endurecimiento que
-- evita que un esquema escribible por roles no privilegiados quede
-- ambientalmente confiable — la razón por la que Supabase expone
-- `extensions` como el esquema pensado para vivir ahí). Resultado:
-- ni el tipo citext ni la tabla profiles (sin calificar) resuelven
-- en ese contexto.
--
-- Esta migración:
--   1. Mueve citext y pg_trgm a extensions (esquema ya presente y
--      accesible en cualquier proyecto Supabase). No requiere
--      recrear la extensión ni tocar datos: los objetos existentes
--      (el tipo de profiles.username, el índice
--      movies_title_trgm_idx) se resuelven por OID interno, no por
--      nombre calificado, así que siguen funcionando sin cambios.
--   2. Reescribe crear_perfil() para calificar cada objeto con su
--      esquema completo (public.profiles, extensions.citext) en vez
--      de agregar `public` al search_path de la función. Así la
--      función no depende de qué search_path tenga el contexto que
--      la dispara — se resuelve igual sea cual sea el rol o el
--      trigger que la llame.
--
-- Cómo aplicar: pegar y correr este archivo entero en el SQL Editor
-- de Supabase. Seguro de re-correr.
-- =============================================================

create schema if not exists extensions;

alter extension citext  set schema extensions;
alter extension pg_trgm set schema extensions;

create or replace function crear_perfil()
returns trigger language plpgsql security definer as $$
declare
  username_candidato extensions.citext;
  username_fallback   extensions.citext := left('user_' || replace(new.id::text, '-', ''), 20);
begin
  username_candidato := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  username_candidato := regexp_replace(username_candidato::text, '[^a-z0-9_]', '', 'g');

  if username_candidato is null
     or char_length(username_candidato::text) < 3
     or char_length(username_candidato::text) > 20 then
    username_candidato := username_fallback;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, username_candidato);
  exception
    when unique_violation then
      insert into public.profiles (id, username) values (new.id, username_fallback);
    when others then
      raise warning 'crear_perfil: no se pudo crear el perfil para %: %', new.id, sqlerrm;
  end;

  return new;
end $$;
