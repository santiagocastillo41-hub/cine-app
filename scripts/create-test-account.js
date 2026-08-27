// Crea (o reutiliza) una cuenta de prueba personal, siguiendo 3 foros
// y con un watchlist poblado, para poder probar la pantalla real de
// "Mi lista" sin pasar por una pantalla de registro. Idempotente.
//
// Uso: node scripts/create-test-account.js
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile()

const { VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, TMDB_READ_TOKEN, TEST_ACCOUNT_PASSWORD } = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SECRET_KEY || !TMDB_READ_TOKEN || !TEST_ACCOUNT_PASSWORD) {
  console.error(
    'Faltan variables en .env (VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, TMDB_READ_TOKEN, TEST_ACCOUNT_PASSWORD)',
  )
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'santiago@cine-app.test'
const PASSWORD = TEST_ACCOUNT_PASSWORD
const USERNAME = 'santiago'

const FORUM_SLUGS = ['cine-de-autor', 'drama', 'terror']

const WATCHLIST = [
  {
    query: 'Perfect Days',
    year: 2023,
    note: 'Me la recomendó Nico. Dice que no pasa nada y que ese es el punto.',
    tags: ['Lenta', 'Para un domingo'],
  },
  {
    query: 'The Zone of Interest',
    year: 2023,
    note: 'Vi el trailer sin sonido y me quedé pensando toda la semana.',
    tags: [],
  },
  { query: 'Aftersun', year: 2022, note: null, tags: ['Corta'] },
  { query: 'Petite Maman', year: 2021, note: null, tags: [] },
]

async function tmdbMovieId(query, year) {
  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('query', query)
  url.searchParams.set('year', year)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TMDB_READ_TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB → HTTP ${res.status}`)
  const data = await res.json()
  return data.results?.[0]?.id ?? null
}

async function getOrCreateUser() {
  const { data: existing, error: findErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', USERNAME)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: USERNAME },
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  const userId = await getOrCreateUser()
  console.log(`✓ usuario ${USERNAME}`)

  const { data: forums, error: forumErr } = await supabase
    .from('forums')
    .select('id, slug')
    .in('slug', FORUM_SLUGS)
  if (forumErr) throw forumErr

  for (const forum of forums ?? []) {
    const { error } = await supabase
      .from('forum_follows')
      .upsert({ user_id: userId, forum_id: forum.id }, { onConflict: 'user_id,forum_id', ignoreDuplicates: true })
    if (error) throw error
  }
  console.log(`✓ sigue ${forums?.length ?? 0} foros`)

  for (const item of WATCHLIST) {
    const movieId = await tmdbMovieId(item.query, item.year)
    if (!movieId) {
      console.log(`  ✗ no encontré "${item.query}" en TMDB`)
      continue
    }
    const { error } = await supabase.from('user_movie').upsert(
      {
        user_id: userId,
        movie_id: movieId,
        status: 'saved',
        note_before: item.note,
        tags: item.tags,
      },
      { onConflict: 'user_id,movie_id' },
    )
    if (error) throw error
    console.log(`  ✓ ${item.query}`)
  }

  console.log('\nListo. Credenciales:')
  console.log(`  email:    ${EMAIL}`)
  console.log(`  password: ${PASSWORD}`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
