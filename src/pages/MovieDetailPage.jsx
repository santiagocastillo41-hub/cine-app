import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { shortDate } from '../lib/format'

export default function MovieDetailPage() {
  const { id } = useParams()
  const movieId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [movie, setMovie] = useState(null)
  const [userMovie, setUserMovie] = useState(null)
  const [followedCount, setFollowedCount] = useState(0)
  const [threads, setThreads] = useState([])

  useEffect(() => {
    if (!user || !movieId) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [{ data: movieData }, { data: um }, { data: follows }] = await Promise.all([
        supabase.from('movies').select('*').eq('id', movieId).single(),
        supabase
          .from('user_movie')
          .select('status, note_before, note_before_at')
          .eq('user_id', user.id)
          .eq('movie_id', movieId)
          .maybeSingle(),
        supabase.from('forum_follows').select('forum_id').eq('user_id', user.id),
      ])

      const followedForumIds = (follows ?? []).map((f) => f.forum_id)

      // Los hilos se filtran a los foros que el usuario sigue: la tesis
      // del producto es que el foro reemplaza el rating, así que acá
      // sólo entra lo que ya eligió leer.
      let threadRows = []
      if (followedForumIds.length > 0) {
        const { data } = await supabase
          .from('threads')
          .select('id, title, reply_count, created_at, forums (name)')
          .eq('movie_id', movieId)
          .in('forum_id', followedForumIds)
          .order('reply_count', { ascending: false })
        threadRows = data ?? []
      }

      if (!cancelled) {
        setMovie(movieData)
        setUserMovie(um)
        setFollowedCount(followedForumIds.length)
        setThreads(threadRows)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, movieId])

  if (loading || !movie) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] items-center justify-center bg-bg">
        <p className="type-body-sm text-text-tertiary">Cargando…</p>
      </div>
    )
  }

  const isBackdrop = Boolean(movie.backdrop_path)
  const heroUrl = isBackdrop ? backdropUrl(movie.backdrop_path, 'w780') : posterUrl(movie.poster_path, 'w500')
  const metaLine = [movie.year, movie.director, movie.runtime ? `${movie.runtime}′` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-bg">
      <div className="flex-1">
        {/* Cabecera: backdrop real, o el poster ampliado y desenfocado si no hay */}
        <div className="relative h-[208px] overflow-hidden">
          {heroUrl && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${heroUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: isBackdrop ? 'center 46%' : 'center 34%',
                backgroundRepeat: 'no-repeat',
                filter: isBackdrop ? 'saturate(1.04) brightness(.94)' : 'blur(22px) saturate(1.15) brightness(.72)',
                transform: isBackdrop ? undefined : 'scale(1.25)',
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(8,9,11,.32) 0%, rgba(8,9,11,.72) 52%, #08090b 100%)',
            }}
          />

          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="absolute top-3 left-4 z-[3] flex h-9 w-9 items-center justify-center rounded-full text-text-primary backdrop-blur-[8px]"
            style={{ background: 'rgba(8,9,11,.6)' }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[17px] w-[17px]"
              stroke="currentColor"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="absolute right-4 bottom-4 left-4 z-[2]">
            <h1 className="type-display-lg">{movie.original_title || movie.title}</h1>
            {metaLine && <p className="type-caption mt-2 text-text-tertiary">{metaLine}</p>}
          </div>
        </div>

        {/* "En mi lista" sigue reflejando el estado sin ser funcional.
            "Ya la vi" navega a la pantalla de marcar como vista sólo si
            todavía no lo está — reabrir ese flujo para una película ya
            vista es otra pantalla (editar la nota posterior), no ésta. */}
        <div className="flex gap-2 px-4 pt-4">
          <ActionButton active={userMovie?.status === 'saved'} icon="bookmark">
            En mi lista
          </ActionButton>
          <ActionButton
            active={userMovie?.status === 'watched'}
            icon="check"
            onClick={userMovie?.status === 'saved' ? () => navigate(`/pelicula/${movieId}/vista`) : undefined}
          >
            Ya la vi
          </ActionButton>
        </div>

        {userMovie?.note_before && (
          <div className="px-4 pt-6">
            {/* .pair: sólo posiciona; .half: agrega el padding-left que deja
                lugar al nodo, exactamente como en tanda-01-v2.html */}
            <div className="relative">
              <div className="relative pl-6">
                <span className="absolute top-1 left-0 h-3 w-3 rounded-full border-[1.5px] border-border bg-bg" />
                <div className="mb-2 flex items-baseline gap-2">
                  <b className="font-display text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-text-secondary">
                    Tu nota
                  </b>
                  <time className="text-[11px] leading-[14px] text-text-tertiary">
                    Guardada el {shortDate(userMovie.note_before_at)}
                  </time>
                </div>
                <p className="type-body-md text-[#DCE0E5]">{userMovie.note_before}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between px-4 pt-8">
          <h2 className="type-display-sm">Qué se dice</h2>
          <span className="type-caption text-text-tertiary">Sin spoilers</span>
        </div>
        <p className="px-4 pt-2 text-[11.5px] leading-4 text-text-tertiary">
          Según los <b className="font-medium text-text-secondary">{followedCount} foros que seguís</b>. Cambiá tus
          foros para ver otras conversaciones.
        </p>

        {threads.length === 0 ? (
          <div className="mx-4 mt-3 rounded-lg border border-dashed border-border px-5 py-6">
            <p className="type-body-sm text-text-secondary">
              Nadie habló de esta película todavía en los foros que seguís.
            </p>
            <p className="type-caption mt-2 text-text-tertiary">
              Podés cambiar qué foros seguís, o ser la primera persona en abrir un hilo.
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              to={`/hilo/${thread.id}`}
              className="mx-4 mt-3 block rounded-lg border border-border-subtle bg-surface-low p-3.5"
            >
              <div className="mb-2 flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-accent-text">
                <span className="h-1.5 w-1.5 rounded-[1.5px] bg-accent" />
                {thread.forums?.name}
              </div>
              <div className="type-display-xs leading-5">{thread.title}</div>
              {/* Deuda: sin un tracker de "última visita" en el schema no
                  podemos distinguir respuestas nuevas de viejas, así que
                  por ahora se muestra sólo el total. El mockup
                  (tanda-01-v2.html, .tcfoot .nu) separa "N respuestas" de
                  "N nuevas" en acento — reintroducir esa segunda pieza
                  cuando exista el tracker. */}
              <div className="mt-2 text-[11.5px] leading-4 text-text-tertiary">
                {thread.reply_count} {thread.reply_count === 1 ? 'respuesta' : 'respuestas'}
              </div>
            </Link>
          ))
        )}

        <div className="h-8" />
      </div>

      <div className="sticky bottom-0 border-t border-border-subtle bg-bg px-4 pt-3 pb-4">
        <button
          type="button"
          className="flex h-12 w-full items-center justify-center rounded-md border border-border text-[15px] font-semibold text-text-primary"
        >
          Hablar de esta película en un foro
        </button>
      </div>
    </div>
  )
}

function ActionButton({ active, icon, onClick, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md text-[13.5px]"
      style={{
        fontWeight: 550,
        border: `1px solid ${active ? 'var(--color-accent-bd)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-accent-bg)' : 'transparent',
        color: active ? 'var(--color-accent-text)' : 'var(--color-text-primary)',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon === 'bookmark' ? (
          <path d="M6 3h12a1 1 0 011 1v16l-7-4-7 4V4a1 1 0 011-1z" />
        ) : (
          <path d="M4 12l5 5L20 7" />
        )}
      </svg>
      {children}
    </Tag>
  )
}
