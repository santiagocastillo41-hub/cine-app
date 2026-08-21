import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { posterUrl } from '../lib/tmdb'

const CHIPS = ['Con novedades', "Menos de 100′", 'Lenta', 'Sin nota']

export default function WatchlistPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('saved')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [signals, setSignals] = useState({})

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [{ data: movieRows, error: movieErr }, { data: follows, error: followErr }] = await Promise.all([
        supabase
          .from('user_movie')
          .select(
            'movie_id, status, note_before, tags, watched_at, movies (id, title, original_title, year, director, runtime, poster_path)',
          )
          .eq('user_id', user.id)
          .order('saved_at', { ascending: false }),
        supabase.from('forum_follows').select('forum_id').eq('user_id', user.id),
      ])

      if (movieErr || followErr) {
        console.error(movieErr ?? followErr)
        if (!cancelled) setLoading(false)
        return
      }

      const followedForumIds = new Set((follows ?? []).map((f) => f.forum_id))
      const savedMovieIds = (movieRows ?? [])
        .filter((r) => r.status === 'saved')
        .map((r) => r.movie_id)

      // Sin un mecanismo de "última visita" en el schema todavía, la
      // señal usa el conteo total de respuestas de los hilos de esta
      // película en foros que seguís, como proxy de "hay algo para leer".
      const signalMap = {}
      if (savedMovieIds.length > 0) {
        const { data: threads } = await supabase
          .from('threads')
          .select('movie_id, forum_id, reply_count, forums (name)')
          .in('movie_id', savedMovieIds)

        for (const t of threads ?? []) {
          if (!followedForumIds.has(t.forum_id) || t.reply_count === 0) continue
          const current = signalMap[t.movie_id]
          if (!current || t.reply_count > current.count) {
            signalMap[t.movie_id] = { count: t.reply_count, forumName: t.forums?.name ?? '' }
          }
        }
      }

      if (!cancelled) {
        setRows(movieRows ?? [])
        setSignals(signalMap)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const saved = useMemo(() => rows.filter((r) => r.status === 'saved'), [rows])
  const watched = useMemo(() => rows.filter((r) => r.status === 'watched'), [rows])
  const visible = tab === 'saved' ? saved : watched

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 pt-2">
        <h1 className="type-display-lg">Mi lista</h1>
      </header>

      <div className="flex gap-6 border-b border-border-subtle px-4 pt-6">
        <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} count={saved.length}>
          Por ver
        </TabButton>
        <TabButton active={tab === 'watched'} onClick={() => setTab('watched')} count={watched.length}>
          Vistas
        </TabButton>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-4 pb-4">
        {CHIPS.map((label, i) => (
          <span
            key={label}
            className={`flex-none whitespace-nowrap rounded-full border px-[11px] py-[6px] text-[11.5px] leading-4 ${
              i === 0 ? 'border-accent-bd bg-accent-bg text-accent-text' : 'border-border text-text-secondary'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex-1 px-4">
        {loading ? (
          <p className="type-body-sm py-8 text-center text-text-tertiary">Cargando…</p>
        ) : visible.length === 0 ? (
          <p className="type-body-sm py-8 text-center text-text-tertiary">
            {tab === 'saved'
              ? 'Todavía no guardaste ninguna película.'
              : 'Todavía no marcaste ninguna película como vista.'}
          </p>
        ) : (
          visible.map((row, i) => (
            <WatchlistRow
              key={row.movie_id}
              row={row}
              signal={signals[row.movie_id]}
              isLast={i === visible.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, count, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 text-[14px] leading-[18px] font-medium ${
        active ? 'text-text-primary' : 'text-text-tertiary'
      }`}
    >
      {children} <span className="text-[11.5px] font-normal text-text-tertiary">{count}</span>
      {active && <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-accent" />}
    </button>
  )
}

function WatchlistRow({ row, signal, isLast }) {
  const movie = row.movies
  const poster = posterUrl(movie?.poster_path)
  const metaParts = [movie?.year, movie?.director, movie?.runtime ? `${movie.runtime}′` : null].filter(Boolean)

  return (
    <div className={`flex gap-3 py-4 ${isLast ? '' : 'border-b border-border-subtle'}`}>
      <div className="h-[66px] w-[46px] flex-none overflow-hidden rounded-xs bg-surface-med">
        {poster && <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="type-display-xs truncate">{movie?.original_title || movie?.title}</h2>

        {metaParts.length > 0 && (
          <p className="type-caption mt-1 text-text-tertiary">{metaParts.join(' · ')}</p>
        )}

        {signal ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] leading-4 font-medium text-accent-text">
            <span className="h-[5px] w-[5px] flex-none rounded-full bg-accent" />
            {signal.count} nuevos en {signal.forumName}
          </div>
        ) : (
          <div className="mt-2 text-[11.5px] leading-4 text-text-tertiary">Sin actividad nueva</div>
        )}

        {row.note_before && (
          <p className="mt-2 border-l-[1.5px] border-border pl-[10px] text-[12.5px] leading-[18px] text-text-secondary">
            {row.note_before}
          </p>
        )}

        {row.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-border px-[7px] py-[3px] text-[10.5px] leading-[14px] text-text-tertiary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
