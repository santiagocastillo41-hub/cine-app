// Verifica la conexión a Supabase (tablas del schema) y a la API de TMDB.
// Uso: node scripts/check.js
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile()

const {
  VITE_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  TMDB_READ_TOKEN,
} = process.env

const EXPECTED_TABLES = [
  'profiles',
  'forums',
  'movies',
  'forum_follows',
  'user_movie',
  'threads',
  'posts',
  'post_mentions',
  'spoiler_flags',
]

async function checkSupabase() {
  console.log('Supabase:')

  if (!VITE_SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.log('  ✗ faltan VITE_SUPABASE_URL o SUPABASE_SECRET_KEY en .env')
    return
  }

  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SECRET_KEY)

  for (const table of EXPECTED_TABLES) {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' })
    if (error) {
      console.log(`  ✗ ${table}: no accesible (${error.message})`)
    } else {
      console.log(`  ✓ ${table}`)
    }
  }
}

async function checkTmdb() {
  console.log('TMDB:')

  if (!TMDB_READ_TOKEN) {
    console.log('  ✗ falta TMDB_READ_TOKEN en .env')
    return
  }

  try {
    const url = new URL('https://api.themoviedb.org/3/search/movie')
    url.searchParams.set('query', 'Perfect Days')
    url.searchParams.set('language', 'es-ES')

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_TOKEN}`,
        accept: 'application/json',
      },
    })

    if (!res.ok) {
      console.log(`  ✗ respuesta HTTP ${res.status}`)
      return
    }

    const data = await res.json()
    const movie = data.results?.[0]

    if (!movie) {
      console.log('  ✗ búsqueda sin resultados')
      return
    }

    console.log('  ✓ conexión OK')
    console.log(`    título: ${movie.title}`)
    console.log(`    año: ${movie.release_date?.slice(0, 4) ?? 'desconocido'}`)
    console.log(`    poster_path: ${movie.poster_path}`)
    console.log(`    backdrop_path: ${movie.backdrop_path}`)
  } catch (err) {
    console.log(`  ✗ error de conexión (${err.message})`)
  }
}

await checkSupabase()
await checkTmdb()
