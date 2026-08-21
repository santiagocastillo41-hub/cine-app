-- =============================================================
--  Esquema de base de datos
--  Postgres / Supabase
--
--  Tres reglas de producto viven acá y no en el código:
--    1. Un hilo no puede existir sin ancla (película o tema).
--    2. Un post no puede existir sin declarar si revela algo.
--    3. La nota previa se congela al marcar la película como vista.
--
--  Si están sólo en la interfaz, cualquier bug las rompe.
--  Acá la base las rechaza.
-- =============================================================

create extension if not exists citext;
create extension if not exists pg_trgm;

-- =============================================================
--  1. PERFILES
-- =============================================================
-- Sin anonimato: el usuario elige un nombre y queda a su nombre
-- todo lo que escriba. citext hace la unicidad insensible a
-- mayúsculas, para que no convivan "Tarkovskiano" y "tarkovskiano".

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            citext not null unique,
  avatar_url          text,
  is_moderator        boolean not null default false,
  is_demo             boolean not null default false,   -- cuentas del modo invitado
  username_changed_at timestamptz,
  created_at          timestamptz not null default now(),

  constraint username_formato check (username ~ '^[a-z0-9_]{3,20}$')
);

comment on column profiles.username_changed_at is
  'Se permite un cambio cada 60 días. La regla se valida en la app, el dato vive acá.';


-- =============================================================
--  2. FOROS
-- =============================================================
-- Los foros por defecto son de género. Los que propone la gente
-- pasan por revisión: curaduría en vez de escala.

create type forum_kind   as enum ('genre', 'craft');
create type forum_status as enum ('approved', 'pending', 'rejected');

create table forums (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null,          -- obligatoria: es lo que más pesa al aprobar
  kind        forum_kind not null,
  status      forum_status not null default 'pending',
  proposed_by uuid references profiles(id) on delete set null,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),

  constraint descripcion_minima check (char_length(description) >= 40)
);

create index forums_status_idx on forums(status) where status = 'approved';


-- =============================================================
--  3. PELÍCULAS
-- =============================================================
-- Caché local de TMDB. Se guarda al primer uso y se refresca
-- cada tanto. Dos campos de imagen, no uno: el poster es
-- vertical para las listas, el backdrop apaisado para cabeceras.
-- No todas las películas tienen backdrop.

create table movies (
  id             integer primary key,       -- id de TMDB
  title          text not null,
  original_title text,
  year           smallint,
  director       text,
  runtime        smallint,
  overview       text,
  poster_path    text,
  backdrop_path  text,                      -- nullable: fallback al poster desenfocado
  synced_at      timestamptz not null default now()
);

create index movies_title_trgm_idx on movies using gin (title gin_trgm_ops);


-- =============================================================
--  4. FOROS QUE SIGUE CADA PERSONA
-- =============================================================
-- No es sólo un feed: define de quién lee opiniones en cada ficha.
-- Es el reemplazo del rating.

create table forum_follows (
  user_id    uuid not null references profiles(id) on delete cascade,
  forum_id   uuid not null references forums(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, forum_id)
);


-- =============================================================
--  5. USER_MOVIE  ·  el corazón del modelo
-- =============================================================
-- Una sola tabla con estado, no dos tablas separadas para
-- "por ver" y "vistas". Si estuvieran separadas, el par
-- antes/después se complica para siempre.

create type movie_status as enum ('saved', 'watched');

create table user_movie (
  user_id  uuid    not null references profiles(id) on delete cascade,
  movie_id integer not null references movies(id)   on delete cascade,
  status   movie_status not null default 'saved',

  -- nota previa: se escribe al guardar, se congela al marcar vista
  note_before        text,
  note_before_at     timestamptz,
  note_before_public boolean not null default false,

  -- nota posterior: se escribe al marcar vista, editable
  note_after         text,
  note_after_at      timestamptz,
  note_after_public  boolean not null default false,

  tags             text[] not null default '{}',   -- etiquetas propias: "lenta", "corta"
  source_thread_id uuid,                           -- de dónde salió (se enlaza más abajo)

  -- "no pienso verla": anula el colapso de spoilers para esta película
  spoilers_off boolean not null default false,

  saved_at   timestamptz not null default now(),
  watched_at timestamptz,

  primary key (user_id, movie_id),

  -- una nota posterior sin haber visto la película no tiene sentido
  constraint nota_posterior_requiere_vista
    check (note_after is null or status = 'watched'),

  -- no se puede publicar una nota que no existe
  constraint publicar_requiere_nota_previa
    check (not note_before_public or note_before is not null),
  constraint publicar_requiere_nota_posterior
    check (not note_after_public or note_after is not null)
);

create index user_movie_status_idx    on user_movie(user_id, status);
create index user_movie_publicas_idx  on user_movie(movie_id)
  where note_before_public or note_after_public;


-- =============================================================
--  6. HILOS
-- =============================================================
-- Nunca existen sin ancla. Es la regla de moderación hecha
-- restricción: sin contenedor libre, no hay dónde crezca el
-- contenido fuera de tema.

create table threads (
  id         uuid primary key default gen_random_uuid(),
  forum_id   uuid not null references forums(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,

  movie_id   integer references movies(id) on delete set null,
  topic      text,                        -- "Dirección", "Guion", "Montaje"

  title      text not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  reply_count      integer not null default 0,

  constraint titulo_minimo check (char_length(title) between 8 and 140),

  -- ancla obligatoria y excluyente: película o tema, nunca ninguno
  constraint ancla_obligatoria check (
    (movie_id is not null and topic is null) or
    (movie_id is null     and topic is not null)
  )
);

create index threads_forum_idx    on threads(forum_id, last_activity_at desc);
create index threads_movie_idx    on threads(movie_id) where movie_id is not null;

alter table user_movie
  add constraint user_movie_source_thread_fk
  foreign key (source_thread_id) references threads(id) on delete set null;


-- =============================================================
--  7. POSTS
-- =============================================================
-- has_spoiler es not null y SIN default. Eso es lo que hace
-- que la pregunta del composer sea imposible de saltear:
-- un insert sin el campo falla.

create type mod_status as enum ('published', 'flagged', 'held', 'rejected');

create table posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references posts(id) on delete cascade,

  body       text not null,
  image_path text,

  has_spoiler boolean not null,           -- sin default, a propósito

  -- corrección colectiva: puntos, no votos. Quien vio la película pesa doble.
  spoiler_points  smallint not null default 0,
  spoiler_by_mod  boolean  not null default false,

  status         mod_status not null default 'published',
  mod_confidence real,                    -- score del clasificador
  mod_reason     text,

  created_at timestamptz not null default now(),
  edited_at  timestamptz,

  constraint cuerpo_minimo check (char_length(body) >= 2)
);

create index posts_thread_idx on posts(thread_id, created_at);
create index posts_cola_idx   on posts(status) where status in ('held','flagged');


-- =============================================================
--  8. MENCIONES DE PELÍCULA
-- =============================================================
-- Convierte la película en entidad de primera clase dentro del
-- texto. Es lo que permite responder "dónde se está hablando
-- de esto" sin buscar por string.

create table post_mentions (
  post_id  uuid    not null references posts(id)  on delete cascade,
  movie_id integer not null references movies(id) on delete cascade,
  primary key (post_id, movie_id)
);

create index post_mentions_movie_idx on post_mentions(movie_id);


-- =============================================================
--  9. MARCAS DE SPOILER NO DECLARADO
-- =============================================================
-- No es un voto negativo: es corrección de metadato. Sin conteo
-- visible, para que no se convierta en votación de acuerdo.

create table spoiler_flags (
  post_id    uuid not null references posts(id)     on delete cascade,
  user_id    uuid not null references profiles(id)  on delete cascade,
  had_seen   boolean not null,      -- ¿quien marca vio la película?
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);


-- =============================================================
--  TRIGGERS  ·  las reglas que no se pueden romper
-- =============================================================

-- ---------------------------------------------------------------
-- A. Congelar la nota previa
-- ---------------------------------------------------------------
-- El formato antes/después sólo tiene valor si la mitad de antes
-- es verificablemente anterior. Una vez que la película pasa a
-- 'watched', esa nota y su fecha ya no se tocan.

create or replace function congelar_nota_previa()
returns trigger language plpgsql as $$
begin
  -- primera vez que se escribe la nota previa: se sella la fecha
  if new.note_before is not null and old.note_before is null then
    new.note_before_at := now();
  end if;

  -- ya estaba vista: la nota previa es inmutable
  if old.status = 'watched' then
    new.note_before    := old.note_before;
    new.note_before_at := old.note_before_at;
  end if;

  -- transición a vista: se sella la fecha de visionado
  if new.status = 'watched' and old.status <> 'watched' then
    new.watched_at := coalesce(new.watched_at, now());
  end if;

  -- la nota posterior sí es editable, pero registra su fecha
  if new.note_after is distinct from old.note_after and new.note_after is not null then
    new.note_after_at := coalesce(old.note_after_at, now());
  end if;

  return new;
end $$;

create trigger trg_congelar_nota_previa
  before update on user_movie
  for each row execute function congelar_nota_previa();

-- también al insertar, por si se guarda ya con nota
create or replace function sellar_nota_previa_insert()
returns trigger language plpgsql as $$
begin
  if new.note_before is not null then
    new.note_before_at := coalesce(new.note_before_at, now());
  end if;
  return new;
end $$;

create trigger trg_sellar_nota_previa
  before insert on user_movie
  for each row execute function sellar_nota_previa_insert();


-- ---------------------------------------------------------------
-- B. Actividad del hilo
-- ---------------------------------------------------------------
-- Ordena el foro y gobierna el decaimiento: un hilo sin respuestas
-- se hunde solo, sin necesidad de votos negativos.

create or replace function actualizar_actividad_hilo()
returns trigger language plpgsql as $$
begin
  update threads
     set last_activity_at = now(),
         reply_count      = reply_count + 1
   where id = new.thread_id;
  return new;
end $$;

create trigger trg_actividad_hilo
  after insert on posts
  for each row
  when (new.status = 'published')
  execute function actualizar_actividad_hilo();


-- ---------------------------------------------------------------
-- C. Corrección colectiva de spoilers
-- ---------------------------------------------------------------
-- Dos puntos colapsan el mensaje. Quien vio la película vale dos
-- puntos: está en posición de saber. Quien no la vio, uno.

create or replace function recalcular_spoiler()
returns trigger language plpgsql as $$
declare
  puntos smallint;
  pid    uuid := coalesce(new.post_id, old.post_id);
begin
  select coalesce(sum(case when had_seen then 2 else 1 end), 0)
    into puntos
    from spoiler_flags where post_id = pid;

  update posts
     set spoiler_points = puntos,
         has_spoiler    = case
                            when spoiler_by_mod then has_spoiler  -- decisión humana manda
                            when puntos >= 2    then true
                            else has_spoiler
                          end
   where id = pid;

  return null;
end $$;

create trigger trg_recalcular_spoiler
  after insert or delete on spoiler_flags
  for each row execute function recalcular_spoiler();


-- ---------------------------------------------------------------
-- D. Crear el perfil al registrarse
-- ---------------------------------------------------------------

create or replace function crear_perfil()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end $$;

create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function crear_perfil();


-- =============================================================
--  ROW LEVEL SECURITY
-- =============================================================
-- Regla general: todo el contenido público se lee, cada quien
-- escribe lo suyo. La excepción interesante es user_movie:
-- tus notas son privadas salvo que las publiques.

alter table profiles      enable row level security;
alter table forums        enable row level security;
alter table movies        enable row level security;
alter table forum_follows enable row level security;
alter table user_movie    enable row level security;
alter table threads       enable row level security;
alter table posts         enable row level security;
alter table post_mentions enable row level security;
alter table spoiler_flags enable row level security;

-- perfiles: visibles para todos, editables por su dueño
create policy perfiles_lectura on profiles for select using (true);
create policy perfiles_edicion on profiles for update using (auth.uid() = id);

-- foros: sólo se ven los aprobados (o los propios en revisión)
create policy foros_lectura on forums for select
  using (status = 'approved' or proposed_by = auth.uid());
create policy foros_propuesta on forums for insert
  with check (proposed_by = auth.uid() and status = 'pending');

-- películas: caché público de lectura
create policy peliculas_lectura on movies for select using (true);

-- seguimientos: cada quien los suyos
create policy follows_lectura on forum_follows for select using (true);
create policy follows_escritura on forum_follows for all using (user_id = auth.uid());

-- USER_MOVIE: lo propio siempre; lo ajeno sólo si está publicado
create policy user_movie_propio on user_movie for all
  using (user_id = auth.uid());
create policy user_movie_publicado on user_movie for select
  using (note_before_public or note_after_public);

-- hilos y posts: lectura pública de lo publicado
create policy hilos_lectura on threads for select using (true);
create policy hilos_creacion on threads for insert with check (author_id = auth.uid());

create policy posts_lectura on posts for select
  using (status in ('published','flagged') or author_id = auth.uid());
create policy posts_creacion on posts for insert with check (author_id = auth.uid());
create policy posts_edicion  on posts for update using (author_id = auth.uid());

create policy menciones_lectura on post_mentions for select using (true);
create policy menciones_creacion on post_mentions for insert with check (true);

-- marcas de spoiler: se pueden crear y retirar, pero no ver de otros
create policy flags_propias on spoiler_flags for all using (user_id = auth.uid());


-- =============================================================
--  VISTAS DE APOYO
-- =============================================================

-- Qué se discute de una película, filtrado por los foros que
-- sigue quien mira. Es la consulta central de la ficha.
create or replace view v_conversacion_por_pelicula as
select
  t.id            as thread_id,
  t.title,
  t.movie_id,
  t.forum_id,
  f.name          as forum_name,
  t.reply_count,
  t.last_activity_at
from threads t
join forums f on f.id = t.forum_id
where f.status = 'approved';

-- Cola de moderación: posts retenidos y foros propuestos en una
-- sola lista. Es lo que hace sostenible operar esto siendo uno.
create or replace view v_cola_moderacion as
select 'post'::text as tipo, p.id, p.body as contenido,
       p.mod_confidence, p.created_at, p.status::text
  from posts p
 where p.status in ('held','flagged')
union all
select 'forum', f.id, f.name || ' — ' || f.description,
       null, f.created_at, f.status::text
  from forums f
 where f.status = 'pending';
