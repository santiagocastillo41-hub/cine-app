import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { avatarGradient } from '../lib/avatar'
import { relativeTime } from '../lib/format'

// Campos completos: para posts abiertos (has_spoiler=false, o cuando
// el hilo entero está desbloqueado para este usuario).
const OPEN_POST_FIELDS =
  'id, body, has_spoiler, created_at, profiles!posts_author_id_fkey (username), post_mentions (movies (id, title, original_title))'

// Campos mínimos: para posts con spoiler cuando el hilo sigue
// colapsado. A propósito NO incluye body ni post_mentions — el
// colapso tiene que ser real en la red, no un CSS que oculta texto
// que ya llegó al cliente.
const COLLAPSED_POST_FIELDS = 'id, has_spoiler, created_at, profiles!posts_author_id_fkey (username)'

function normalizeMentions(post) {
  return (post.post_mentions ?? []).map((pm) => pm.movies).filter(Boolean)
}

export default function ThreadPage() {
  const { id: threadId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState(null)
  const [userMovie, setUserMovie] = useState(null)
  const [posts, setPosts] = useState([])
  const [mentionedMoviesCount, setMentionedMoviesCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user || !threadId) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const { data: threadData } = await supabase
        .from('threads')
        .select('id, title, movie_id, topic, reply_count, forums (name), movies (id, title, original_title)')
        .eq('id', threadId)
        .single()

      if (!threadData) {
        if (!cancelled) {
          setThread(null)
          setLoading(false)
        }
        return
      }

      let um = null
      if (threadData.movie_id) {
        const { data } = await supabase
          .from('user_movie')
          .select('status, spoilers_off')
          .eq('user_id', user.id)
          .eq('movie_id', threadData.movie_id)
          .maybeSingle()
        um = data
      }

      const spoilersOpen = Boolean(threadData.movie_id) && (um?.status === 'watched' || um?.spoilers_off === true)

      let postsData
      if (spoilersOpen) {
        const { data } = await supabase
          .from('posts')
          .select(OPEN_POST_FIELDS)
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
        postsData = (data ?? []).map((p) => ({ ...p, mentions: normalizeMentions(p), revealed: true }))
      } else {
        const [{ data: open }, { data: collapsed }] = await Promise.all([
          supabase
            .from('posts')
            .select(OPEN_POST_FIELDS)
            .eq('thread_id', threadId)
            .eq('has_spoiler', false)
            .order('created_at', { ascending: true }),
          supabase
            .from('posts')
            .select(COLLAPSED_POST_FIELDS)
            .eq('thread_id', threadId)
            .eq('has_spoiler', true)
            .order('created_at', { ascending: true }),
        ])
        postsData = [
          ...(open ?? []).map((p) => ({ ...p, mentions: normalizeMentions(p), revealed: true })),
          ...(collapsed ?? []).map((p) => ({ ...p, revealed: false })),
        ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }

      // Conteo agregado del header: sólo cuántas películas distintas se
      // mencionan, nunca el texto. No revela contenido de un post
      // colapsado, así que es seguro calcularlo sobre todos los posts.
      const postIds = postsData.map((p) => p.id)
      let moviesCount = 0
      if (postIds.length > 0) {
        const { data: mentions } = await supabase.from('post_mentions').select('movie_id').in('post_id', postIds)
        moviesCount = new Set((mentions ?? []).map((m) => m.movie_id)).size
      }

      if (!cancelled) {
        setThread(threadData)
        setUserMovie(um)
        setPosts(postsData)
        setMentionedMoviesCount(moviesCount)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, threadId, reloadKey])

  async function revealPost(postId) {
    const { data } = await supabase
      .from('posts')
      .select('body, post_mentions (movies (id, title, original_title))')
      .eq('id', postId)
      .single()
    if (!data) return
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, body: data.body, mentions: normalizeMentions(data), revealed: true } : p,
      ),
    )
  }

  async function revealAllForMovie() {
    if (!thread?.movie_id) return
    await supabase
      .from('user_movie')
      .upsert({ user_id: user.id, movie_id: thread.movie_id, spoilers_off: true }, { onConflict: 'user_id,movie_id' })
    setReloadKey((k) => k + 1)
  }

  if (loading || !thread) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] items-center justify-center bg-bg">
        <p className="type-body-sm text-text-tertiary">{loading ? 'Cargando…' : 'No encontramos este hilo.'}</p>
      </div>
    )
  }

  const spoilersOpen = Boolean(thread.movie_id) && (userMovie?.status === 'watched' || userMovie?.spoilers_off === true)
  const showBanner = Boolean(thread.movie_id) && userMovie?.status === 'saved' && !spoilersOpen
  const hasCollapsed = posts.some((p) => !p.revealed)
  const showRevealAllPrompt = Boolean(thread.movie_id) && !spoilersOpen && hasCollapsed

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-bg">
      <div className="flex-1">
        <div className="flex items-center gap-3 px-4 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-med text-text-primary"
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
          <div className="flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-accent-text">
            <span className="h-1.5 w-1.5 rounded-[1.5px] bg-accent" />
            {thread.forums?.name}
          </div>
        </div>

        <div className="px-4 pt-4">
          <h1 className="type-display-md">{thread.title}</h1>
          <p className="type-caption mt-2 text-text-tertiary">
            {thread.reply_count} {thread.reply_count === 1 ? 'respuesta' : 'respuestas'}
            {mentionedMoviesCount > 0 &&
              ` · ${mentionedMoviesCount} ${mentionedMoviesCount === 1 ? 'película mencionada' : 'películas mencionadas'}`}
          </p>
        </div>

        {showBanner && (
          <>
            <div className="h-4" />
            <div className="mx-4 flex items-start gap-2.5 rounded-lg border border-accent-bd bg-accent-bg p-3">
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-[15px] w-[15px] flex-none"
                stroke="var(--color-accent)"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16v.5" />
              </svg>
              <p className="text-[12.5px] leading-[18px] text-[#BBD9F7]">
                <b className="font-semibold">{thread.movies?.original_title || thread.movies?.title}</b> está en tu
                lista sin ver. Los mensajes que revelan algo llegan cerrados.
              </p>
            </div>
          </>
        )}

        <div className="h-2" />

        {posts.map((post) =>
          post.revealed ? (
            <OpenPostRow key={post.id} post={post} />
          ) : (
            <CollapsedPostRow key={post.id} post={post} onReveal={() => revealPost(post.id)} />
          ),
        )}

        {showRevealAllPrompt && (
          <div className="px-4 pt-2">
            <div className="border-t border-border-subtle pt-4">
              <span className="type-caption text-text-tertiary">
                ¿No pensás ver {thread.movies?.original_title || thread.movies?.title}?
              </span>
              <button
                type="button"
                onClick={revealAllForMovie}
                className="mt-1.5 block text-[12.5px] leading-[17px] font-semibold text-accent-text"
              >
                Mostrarme todo de esta película
              </button>
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>

      <div className="border-t border-border-subtle bg-bg px-4 pt-3 pb-4">
        <div className="flex h-11 items-center rounded-full border border-border px-4 text-[13.5px] text-text-tertiary">
          Escribir una respuesta…
        </div>
      </div>
    </div>
  )
}

function renderBodyWithMentions(body, mentions) {
  if (!mentions || mentions.length === 0) return body

  const candidates = []
  for (const m of mentions) {
    for (const t of [m.original_title, m.title]) {
      if (t) candidates.push({ text: t, movieId: m.id })
    }
  }
  candidates.sort((a, b) => b.text.length - a.text.length)
  if (candidates.length === 0) return body

  const escaped = candidates.map((c) => c.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = body.split(pattern)

  return parts.map((part, i) => {
    const match = candidates.find((c) => c.text.toLowerCase() === part.toLowerCase())
    if (!match) return part
    return (
      <Link
        key={i}
        to={`/pelicula/${match.movieId}`}
        className="mx-0.5 inline-flex items-center rounded-[4px] border border-accent-bd bg-accent-bg px-[6px] py-[1px] text-[12.5px] font-medium text-accent-text"
      >
        {part}
      </Link>
    )
  })
}

function OpenPostRow({ post }) {
  return (
    <div className="border-b border-border-subtle px-4 py-4">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-[26px] w-[26px] flex-none rounded-full"
          style={{ background: avatarGradient(post.profiles?.username ?? '') }}
        />
        <span className="type-label">{post.profiles?.username}</span>
        <span className="type-caption text-text-tertiary">{relativeTime(post.created_at)}</span>
      </div>
      <div className="type-body-md text-[#DCE0E5]">{renderBodyWithMentions(post.body, post.mentions)}</div>
      <div className="mt-3 flex gap-5 text-[11.5px] leading-4 text-text-tertiary">
        <span>Responder</span>
        <span>Revela algo</span>
      </div>
    </div>
  )
}

function CollapsedPostRow({ post, onReveal }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border-subtle bg-surface-low px-4 py-[13px]">
      <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-surface-high">
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          stroke="var(--color-text-tertiary)"
          fill="none"
          strokeWidth="1.8"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="type-label text-text-secondary">{post.profiles?.username}</div>
        <div className="type-caption mt-0.5 text-text-tertiary">Revela algo de la película</div>
      </div>
      <button type="button" onClick={onReveal} className="type-label font-semibold text-accent-text">
        Mostrar
      </button>
    </div>
  )
}
