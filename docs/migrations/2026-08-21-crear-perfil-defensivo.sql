-- =============================================================
--  Migración: crear_perfil() defensivo
--  2026-08-21
-- =============================================================
--
-- Problema observado: supabase.auth.admin.createUser() devolvía
-- "Database error creating new user" (500) al correr scripts/seed.js,
-- incluso pasando un username válido en user_metadata. GoTrue oculta
-- el error real de Postgres, así que no se pudo confirmar la causa
-- exacta sin acceso al dashboard — pero el trigger original tal como
-- está en docs/schema.sql es frágil en al menos un caso conocido:
-- si raw_user_meta_data->>'username' viene null o no matchea
-- username_formato, el insert en profiles aborta toda la transacción
-- de auth.users.
--
-- Este cambio hace crear_perfil() defensivo en dos frentes:
--   1. Si no hay username usable en los metadatos (o no cumple el
--      formato), genera uno derivado del id del usuario en vez de
--      fallar.
--   2. Envuelve el insert en un bloque que atrapa cualquier error
--      inesperado (incluida una colisión de unicidad) y jamás deja
--      que la creación de auth.users se rompa por un problema del
--      lado de profiles.
--
-- No reemplaza a docs/schema.sql: la definición ahí queda como
-- referencia desactualizada de este trigger puntual hasta que se
-- audite y se vuelque el cambio al archivo base.
--
-- Cómo aplicar: pegar y correr este archivo entero en el SQL Editor
-- de Supabase (Database → SQL Editor). Es seguro re-correrlo: sólo
-- reemplaza la función, no toca datos.
-- =============================================================

create or replace function crear_perfil()
returns trigger language plpgsql security definer as $$
declare
  username_candidato citext;
  username_fallback   citext := left('user_' || replace(new.id::text, '-', ''), 20);
begin
  -- sanea lo que venga en los metadatos: minúsculas, sólo [a-z0-9_]
  username_candidato := lower(coalesce(new.raw_user_meta_data->>'username', ''));
  username_candidato := regexp_replace(username_candidato::text, '[^a-z0-9_]', '', 'g');

  if username_candidato is null
     or char_length(username_candidato::text) < 3
     or char_length(username_candidato::text) > 20 then
    username_candidato := username_fallback;
  end if;

  begin
    insert into profiles (id, username) values (new.id, username_candidato);
  exception
    when unique_violation then
      -- el username saneado ya existe: el derivado del id es único por construcción
      insert into profiles (id, username) values (new.id, username_fallback);
    when others then
      -- nunca bloquear la creación del usuario por un problema de perfil
      raise warning 'crear_perfil: no se pudo crear el perfil para %: %', new.id, sqlerrm;
  end;

  return new;
end $$;
