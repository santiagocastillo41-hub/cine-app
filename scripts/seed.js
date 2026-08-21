// Carga contenido semilla mínimo: 12 películas, 4 foros, 4 usuarios de
// prueba, 8 hilos anclados, ~30 respuestas y 4 pares antes/después.
// Idempotente: correrlo dos veces no duplica nada.
//
// Los usuarios de prueba se crean vía la Admin API de Supabase
// (supabase.auth.admin.createUser), que requiere la service_role key.
// El trigger trg_crear_perfil de docs/schema.sql crea la fila en
// `profiles` automáticamente al insertarse en auth.users, tomando el
// username de raw_user_meta_data. No se inserta en `profiles` a mano.
//
// Uso: node scripts/seed.js
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

process.loadEnvFile()

const { VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, TMDB_READ_TOKEN } = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SECRET_KEY || !TMDB_READ_TOKEN) {
  console.error('Faltan variables en .env (VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, TMDB_READ_TOKEN)')
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TMDB_BASE = 'https://api.themoviedb.org/3'

async function tmdb(path, params = {}) {
  const url = new URL(TMDB_BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB ${path} → HTTP ${res.status}`)
  return res.json()
}

// =============================================================
//  1. USUARIOS DE PRUEBA
// =============================================================

const USERS = [
  { username: 'tarkovskiano' },
  { username: 'peliculasyfrio' },
  { username: 'nouvellevague_82' },
  { username: 'meridiano_sur' },
]

async function getOrCreateUser(username) {
  const { data: existing, error: findErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing.id

  const email = `${username}@demo.cine-app.test`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { username },
  })
  if (error) throw error

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ is_demo: true })
    .eq('id', data.user.id)
  if (updErr) throw updErr

  return data.user.id
}

// =============================================================
//  2. PELÍCULAS
// =============================================================

const MOVIES = [
  { key: 'perfect-days', query: 'Perfect Days', year: 2023 },
  { key: 'zona-interes', query: 'The Zone of Interest', year: 2023 },
  { key: 'aftersun', query: 'Aftersun', year: 2022 },
  { key: 'petite-maman', query: 'Petite Maman', year: 2021 },
  { key: 'anatomia', query: "Anatomie d'une chute", year: 2023 },
  { key: 'espiritus-isla', query: 'The Banshees of Inisherin', year: 2022 },
  { key: 'drive-my-car', query: 'Drive My Car', year: 2021 },
  { key: 'stalker', query: 'Stalker', year: 1979 },
  { key: 'vidas-pasadas', query: 'Past Lives', year: 2023 },
  { key: 'mal-no-existe', query: 'Evil Does Not Exist', year: 2023 },
  { key: 'ruleta-fortuna', query: 'Wheel of Fortune and Fantasy', year: 2021 },
  { key: 'auge-humano', query: 'The Human Surge', year: 2016 },
]

async function fetchAndUpsertMovie({ query, year }) {
  const search = await tmdb('/search/movie', { query, year, language: 'es-ES' })
  const match = search.results?.[0]
  if (!match) throw new Error(`TMDB: sin resultados para "${query}"`)

  const [detail, english] = await Promise.all([
    tmdb(`/movie/${match.id}`, { language: 'es-ES', append_to_response: 'credits' }),
    // El campo original_title de TMDB devuelve el guion nativo para
    // idiomas no latinos (p. ej. "ドライブ・マイ・カー"), que no es
    // el título por el que se conoce la película en el circuito de
    // festivales. El título en inglés sí coincide con esa convención
    // ("Drive My Car", "Stalker"), así que es lo que mostramos.
    tmdb(`/movie/${match.id}`, { language: 'en-US' }),
  ])

  const director = detail.credits?.crew
    ?.filter((c) => c.job === 'Director')
    .map((c) => c.name)
    .join(' / ') || null

  const row = {
    id: detail.id,
    title: detail.title,
    original_title: english.title,
    year: detail.release_date ? Number(detail.release_date.slice(0, 4)) : null,
    director,
    runtime: detail.runtime,
    overview: detail.overview,
    poster_path: detail.poster_path,
    backdrop_path: detail.backdrop_path,
  }

  const { error } = await supabase.from('movies').upsert(row, { onConflict: 'id' })
  if (error) throw error

  return row.id
}

// =============================================================
//  3. FOROS
// =============================================================

const FORUMS = [
  {
    slug: 'cine-de-autor',
    name: 'Cine de autor',
    kind: 'genre',
    description:
      'Películas donde no pasa nada y aun así no podés dejar de mirar. Autores con firma reconocible: plano, ritmo y silencio antes que trama.',
  },
  {
    slug: 'drama',
    name: 'Drama',
    kind: 'genre',
    description:
      'Lo que la película elige no mostrar. Actuación, dirección de actores y las decisiones que se sienten y no se explican.',
  },
  {
    slug: 'terror',
    name: 'Terror',
    kind: 'genre',
    description:
      'Del giallo al terror lento contemporáneo. Se discute tensión, sonido y qué hace que algo dé miedo.',
  },
  {
    slug: 'guion',
    name: 'Guion',
    kind: 'craft',
    description:
      'Estructura, diálogo, qué se dice y qué se calla. Se leen películas como se leen textos.',
  },
]

async function upsertForum(forum) {
  const { data, error } = await supabase
    .from('forums')
    .upsert({ ...forum, status: 'approved' }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// =============================================================
//  4. HILOS
// =============================================================

const THREADS = [
  {
    key: 't1',
    forumSlug: 'cine-de-autor',
    topic: 'Ritmo contemplativo',
    title: 'Películas donde no pasa nada y aun así no podés dejar de mirar',
    author: 'tarkovskiano',
  },
  {
    key: 't2',
    forumSlug: 'drama',
    movieKey: 'perfect-days',
    title: 'Wenders volvió, y volvió distinto',
    author: 'peliculasyfrio',
  },
  {
    key: 't3',
    forumSlug: 'cine-de-autor',
    movieKey: 'drive-my-car',
    title: 'Adaptar a Murakami sin traicionarlo',
    author: 'meridiano_sur',
  },
  {
    key: 't4',
    forumSlug: 'drama',
    movieKey: 'mal-no-existe',
    title: 'El final que nadie termina de explicar igual',
    author: 'nouvellevague_82',
  },
  {
    key: 't5',
    forumSlug: 'drama',
    movieKey: 'anatomia',
    title: '¿Ella lo hizo? La película se niega a decidir por vos',
    author: 'peliculasyfrio',
  },
  {
    key: 't6',
    forumSlug: 'cine-de-autor',
    movieKey: 'stalker',
    title: 'La Zona no es un lugar, es un estado',
    author: 'tarkovskiano',
  },
  {
    key: 't7',
    forumSlug: 'terror',
    movieKey: 'zona-interes',
    title: 'El terror que no necesita un solo grito',
    author: 'nouvellevague_82',
  },
  {
    key: 't8',
    forumSlug: 'guion',
    topic: 'Exposición',
    title: 'Exposición: cuándo es necesaria y cuándo es pereza',
    author: 'meridiano_sur',
  },
]

async function getOrCreateThread({ forumId, movieId, topic, title, authorId }) {
  const { data: existing, error: findErr } = await supabase
    .from('threads')
    .select('id')
    .eq('forum_id', forumId)
    .eq('title', title)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing.id

  const { data, error } = await supabase
    .from('threads')
    .insert({
      forum_id: forumId,
      author_id: authorId,
      movie_id: movieId ?? null,
      topic: topic ?? null,
      title,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// =============================================================
//  5. RESPUESTAS
// =============================================================

const POSTS = [
  // t1 · Ritmo contemplativo
  { thread: 't1', author: 'tarkovskiano', hasSpoiler: false, mentions: ['perfect-days'],
    body: 'Perfect Days es el ejemplo que tengo más fresco: barre la vereda, riega las plantas, saca la misma foto todos los días. No pasa nada en el sentido de plot, pero después de la tercera repetición empezás a leer las variaciones mínimas como si fueran noticias.' },
  { thread: 't1', author: 'peliculasyfrio', hasSpoiler: false, mentions: ['stalker'],
    body: 'Para mí el origen de todo esto es Stalker. Tarkovsky te hace caminar dos horas por un pantano y en algún momento dejás de esperar que pase algo y empezás a mirar cómo respira el encuadre.' },
  { thread: 't1', author: 'nouvellevague_82', hasSpoiler: false, mentions: ['auge-humano'],
    body: 'El caso límite es El auge del humano: ahí ni siquiera hay una rutina que te ancle como en Perfect Days. Es plano errante puro. A mí me sostuvo la curiosidad geográfica, pero entiendo a quien la abandona a los veinte minutos.' },
  { thread: 't1', author: 'meridiano_sur', hasSpoiler: false,
    body: 'Creo que la diferencia entre esto y aburrimiento a secas es si el director controla la duración de cada plano o si simplemente dejó correr la cámara. Se nota cuando un corte llega tarde a propósito y cuando llega tarde porque se olvidaron de editar.' },
  { thread: 't1', author: 'tarkovskiano', hasSpoiler: false,
    body: 'Totalmente. Y con Perfect Days encima está la variable del oficio del protagonista: limpia baños. La cámara mirando un trabajo manual repetitivo hace la mitad del trabajo de generar ese estado.' },

  // t2 · Wenders volvió, y volvió distinto
  { thread: 't2', author: 'peliculasyfrio', hasSpoiler: false,
    body: 'Vengo de odiar bastante lo último de Wenders, entré desconfiado. A los veinte minutos ya había bajado la guardia.' },
  { thread: 't2', author: 'tarkovskiano', hasSpoiler: false,
    body: 'Lo que más se agradece es que dejó de subrayar. En sus películas de la última década siempre había un personaje que te explicaba el tema en voz alta. Acá no hay nadie que te explique nada.' },
  { thread: 't2', author: 'nouvellevague_82', hasSpoiler: true,
    body: 'Hay una escena cerca del final que, si la leés esperando un quiebre emocional grande, decepciona un poco. A mí me gustó más leerla como que por primera vez deja que se note algo que siempre estuvo.' },
  { thread: 't2', author: 'meridiano_sur', hasSpoiler: false,
    body: 'Coincido con lo de no explicar. El personaje nunca dice por qué eligió esa vida y la película tampoco lo justifica. Uno decide creerle o no.' },

  // t3 · Adaptar a Murakami sin traicionarlo
  { thread: 't3', author: 'meridiano_sur', hasSpoiler: false,
    body: 'Tres horas para un cuento de Murakami de treinta páginas me generaba dudas antes de verla. Ya la vi y entiendo por qué las necesitaba.' },
  { thread: 't3', author: 'tarkovskiano', hasSpoiler: false,
    body: 'El cuento es apenas el disparador. Lo que hace Hamaguchi es meter Tío Vania como espejo del protagonista, algo que no está en el texto original pero termina sintiéndose inevitable.' },
  { thread: 't3', author: 'peliculasyfrio', hasSpoiler: true,
    body: 'Funciona, aunque el monólogo final me pareció que explicaba algo que el auto ya había mostrado sin palabras.' },
  { thread: 't3', author: 'nouvellevague_82', hasSpoiler: true,
    body: 'Depende de para quién. A mí el monólogo no me sobró, me pareció el único momento donde el personaje se permite decir en voz alta lo que estuvo actuando en silencio todo el resto.' },

  // t4 · El final que nadie termina de explicar igual
  { thread: 't4', author: 'nouvellevague_82', hasSpoiler: false, mentions: ['ruleta-fortuna', 'mal-no-existe'],
    body: 'Después de La ruleta de la fortuna y la fantasía esperaba algo más liviano de Hamaguchi. El mal no existe cambia de género a mitad de camino y no todos van a querer acompañarlo.' },
  { thread: 't4', author: 'meridiano_sur', hasSpoiler: true,
    body: 'El final es el punto de quiebre de cualquier conversación sobre esta película. A mí me parece que la ambigüedad está puesta a propósito, no es un final abierto por pereza.' },
  { thread: 't4', author: 'tarkovskiano', hasSpoiler: true,
    body: 'La escena del ciervo cambia completamente cómo leés todo lo anterior. Ahí entendés que la película venía hablando de otra cosa desde el principio.' },
  { thread: 't4', author: 'peliculasyfrio', hasSpoiler: false,
    body: 'Sin entrar en el final: lo que más me interesó es cómo filma el trabajo físico, cortar leña, cargar agua. Ahí ya estaba anticipando el tono antes de que el argumento girara.' },

  // t5 · ¿Ella lo hizo?
  { thread: 't5', author: 'peliculasyfrio', hasSpoiler: false,
    body: 'Entré queriendo que fuera un thriller de juicio clásico. Es otra cosa: un matrimonio diseccionado con la excusa del proceso.' },
  { thread: 't5', author: 'tarkovskiano', hasSpoiler: true,
    body: 'Lo que me rompió la cabeza es cómo la película nunca te deja resolver si ella lo hizo, y el chico termina teniendo que elegir en qué versión creer para poder seguir viviendo.' },
  { thread: 't5', author: 'nouvellevague_82', hasSpoiler: true,
    body: 'Coincido en que no resuelve, pero me parece que sí deja pistas de a qué lado se inclina. La escena de la pelea grabada es la más honesta de la película y ahí no hay ambigüedad posible.' },
  { thread: 't5', author: 'meridiano_sur', hasSpoiler: false,
    body: 'El idioma es la mejor decisión de guion. Ella defendiéndose en un idioma que no es el suyo dice más sobre el matrimonio que cualquier diálogo explícito.' },

  // t6 · La Zona no es un lugar, es un estado
  { thread: 't6', author: 'tarkovskiano', hasSpoiler: false,
    body: 'La Zona no necesita reglas explicadas para funcionar. Apenas sabés que cambia según quién entra, y con eso alcanza.' },
  { thread: 't6', author: 'peliculasyfrio', hasSpoiler: false,
    body: 'Lo que más me interesa es que los tres personajes van buscando algo distinto a lo que dicen buscar. La Zona funciona como espejo, no como obstáculo.' },
  { thread: 't6', author: 'meridiano_sur', hasSpoiler: false,
    body: 'Es una de esas películas donde el ritmo es el argumento. Si la ves acelerada en tu cabeza, ya la arruinaste.' },

  // t7 · El terror que no necesita un solo grito
  { thread: 't7', author: 'nouvellevague_82', hasSpoiler: false,
    body: 'La pongo acá y no en Drama a propósito. El sonido de fondo hace todo el trabajo que en otra película haría una banda sonora de terror.' },
  { thread: 't7', author: 'meridiano_sur', hasSpoiler: false,
    body: 'Estoy de acuerdo. Nunca ves nada explícito y aun así es de las películas más perturbadoras que vi en años. El terror está en lo que la familia normaliza sin comentario.' },
  { thread: 't7', author: 'tarkovskiano', hasSpoiler: true,
    body: 'El corte final es lo más cerca que estuvo de un jump scare sin serlo. Ahí se nota que Glazer entiende de terror aunque la película no se venda como tal.' },

  // t8 · Exposición
  { thread: 't8', author: 'meridiano_sur', hasSpoiler: false,
    body: 'La regla que uso: si un personaje dice algo que ya vimos, es pereza. Si dice algo que reencuadra lo que vimos, es guion.' },
  { thread: 't8', author: 'peliculasyfrio', hasSpoiler: false, mentions: ['drive-my-car'],
    body: 'El monólogo final de Drive My Car es un buen caso límite para discutir esto. Para algunos es exposición innecesaria, para otros es el único momento donde el personaje se permite hablar.' },
  { thread: 't8', author: 'nouvellevague_82', hasSpoiler: false, mentions: ['anatomia'],
    body: 'En Anatomía de una caída casi no hay exposición tradicional: te enterás de la historia del matrimonio a través de lo que cada testigo elige contar, nunca de un flashback prolijo.' },
]

async function getOrCreatePost({ threadId, authorId, body, hasSpoiler }) {
  const { data: existing, error: findErr } = await supabase
    .from('posts')
    .select('id')
    .eq('thread_id', threadId)
    .eq('body', body)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing.id

  const { data, error } = await supabase
    .from('posts')
    .insert({ thread_id: threadId, author_id: authorId, body, has_spoiler: hasSpoiler })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function ensureMention(postId, movieId) {
  const { error } = await supabase
    .from('post_mentions')
    .upsert({ post_id: postId, movie_id: movieId }, { onConflict: 'post_id,movie_id', ignoreDuplicates: true })
  if (error) throw error
}

// =============================================================
//  6. PARES ANTES/DESPUÉS
// =============================================================

const PAIRS = [
  {
    username: 'tarkovskiano',
    movieKey: 'perfect-days',
    before: 'La guardé porque odié la última de Wenders y quiero saber si sigue haciendo lo mismo.',
    after: 'No hace lo mismo. Se sacó de encima la necesidad de explicar. Fui a buscar pelea y me quedé quieto dos horas.',
  },
  {
    username: 'peliculasyfrio',
    movieKey: 'anatomia',
    before: 'Me interesa más el juicio que el crimen. Ojalá no se le vaya a thriller.',
    after: 'No se le va. Es una película sobre un idioma que ninguno de los dos habla del todo bien.',
  },
  {
    username: 'meridiano_sur',
    movieKey: 'drive-my-car',
    before: 'Tres horas me parecen muchas para un cuento de treinta páginas.',
    after: 'Las tres horas son el punto. El duelo tarda lo que tarda y la película se niega a apurarlo.',
  },
  {
    username: 'nouvellevague_82',
    movieKey: 'espiritus-isla',
    before: 'Esperaba una comedia negra sobre una amistad rota.',
    after: 'Comedia dura poco. Después es una película sobre un país partiéndose y dos tipos que no saben decirlo.',
  },
]

async function upsertPair({ userId, movieId, before, after }) {
  const now = new Date()
  const savedAt = new Date(now.getTime() - 20 * 86400000).toISOString()
  const watchedAt = new Date(now.getTime() - 12 * 86400000).toISOString()

  const { error } = await supabase.from('user_movie').upsert(
    {
      user_id: userId,
      movie_id: movieId,
      status: 'watched',
      note_before: before,
      note_before_at: savedAt,
      note_before_public: true,
      note_after: after,
      note_after_at: watchedAt,
      note_after_public: true,
      saved_at: savedAt,
      watched_at: watchedAt,
    },
    { onConflict: 'user_id,movie_id' },
  )
  if (error) throw error
}

// =============================================================
//  MAIN
// =============================================================

async function main() {
  console.log('Usuarios de prueba…')
  const userIds = {}
  for (const u of USERS) {
    userIds[u.username] = await getOrCreateUser(u.username)
    console.log(`  ✓ ${u.username}`)
  }

  console.log('Películas (TMDB)…')
  const movieIds = {}
  for (const m of MOVIES) {
    movieIds[m.key] = await fetchAndUpsertMovie(m)
    console.log(`  ✓ ${m.query}`)
  }

  console.log('Foros…')
  const forumIds = {}
  for (const f of FORUMS) {
    forumIds[f.slug] = await upsertForum(f)
    console.log(`  ✓ ${f.name}`)
  }

  console.log('Hilos…')
  const threadIds = {}
  for (const t of THREADS) {
    threadIds[t.key] = await getOrCreateThread({
      forumId: forumIds[t.forumSlug],
      movieId: t.movieKey ? movieIds[t.movieKey] : null,
      topic: t.topic ?? null,
      title: t.title,
      authorId: userIds[t.author],
    })
    console.log(`  ✓ ${t.title}`)
  }

  console.log('Respuestas…')
  let postCount = 0
  for (const p of POSTS) {
    const postId = await getOrCreatePost({
      threadId: threadIds[p.thread],
      authorId: userIds[p.author],
      body: p.body,
      hasSpoiler: p.hasSpoiler,
    })
    for (const movieKey of p.mentions ?? []) {
      await ensureMention(postId, movieIds[movieKey])
    }
    postCount++
  }
  console.log(`  ✓ ${postCount} respuestas`)

  console.log('Pares antes/después…')
  for (const pair of PAIRS) {
    await upsertPair({
      userId: userIds[pair.username],
      movieId: movieIds[pair.movieKey],
      before: pair.before,
      after: pair.after,
    })
    console.log(`  ✓ ${pair.username} · ${pair.movieKey}`)
  }

  console.log('Listo.')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
