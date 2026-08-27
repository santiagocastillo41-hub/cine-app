import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { shortDate } from '../lib/format'

export default function MarkWatchedPage() {
  const { id } = useParams()
  const movieId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [movie, setMovie] = useState(null)
  const [userMovie, setUserMovie] = useState(null)

  const [noteAfter, setNoteAfter] = useState('')
  const [publishBefore, setPublishBefore] = useState(false)
  const [publishAfter, setPublishAfter] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user || !movieId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [{ data: um }, { data: movieData }] = await Promise.all([
        supabase
          .from('user_movie')
          .select('status, note_before, note_before_at')
          .eq('user_id', user.id)
          .eq('movie_id', movieId)
          .maybeSingle(),
        supabase.from('movies').select('id, title, original_title').eq('id', movieId).single(),
      ])
      if (!cancelled) {
        setUserMovie(um)
        setMovie(movieData)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, movieId])

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] items-center justify-center bg-bg">
        <p className="type-body-sm text-text-tertiary">Cargando…</p>
      </div>
    )
  }

  // No hay nada que transicionar: la película no está guardada, o ya
  // está vista (editar la nota posterior de algo ya visto es otra
  // pantalla, no ésta).
  if (!userMovie || userMovie.status === 'watched') {
    return <Navigate to={`/pelicula/${movieId}`} replace />
  }

  const movieName = movie?.original_title || movie?.title

  async function handleSubmit() {
    setSubmitting(true)

    const payload = {
      status: 'watched',
      note_after: noteAfter.trim() || null,
      note_after_public: publishAfter && Boolean(noteAfter.trim()),
    }
    if (userMovie.note_before) {
      payload.note_before_public = publishBefore
    }

    const { error } = await supabase
      .from('user_movie')
      .update(payload)
      .eq('user_id', user.id)
      .eq('movie_id', movieId)

    if (error) {
      console.error(error)
      setSubmitting(false)
      return
    }

    navigate(`/pelicula/${movieId}`, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-bg">
      <div className="flex-1">
        <div className="flex items-center justify-between px-4 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-med text-text-primary"
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
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className="type-label text-text-tertiary">{movieName}</span>
          <div className="w-9" />
        </div>

        <div className="px-4 pt-6">
          <h1 className="type-display-lg">¿Dio lo que esperabas?</h1>
        </div>

        <div className="px-4 pt-8">
          {userMovie.note_before ? (
            <div className="relative">
              <span
                className="absolute h-px"
                style={{
                  left: '5.5px',
                  top: '16px',
                  bottom: '16px',
                  background:
                    'linear-gradient(to bottom, var(--color-border) 0%, var(--color-accent-bd) 46%, var(--color-accent-bd) 54%, var(--color-border) 100%)',
                }}
              />
              <div className="relative pb-5 pl-6">
                <span className="absolute top-1 left-0 h-3 w-3 rounded-full border-[1.5px] border-border bg-bg" />
                <div className="mb-2 flex items-baseline gap-2">
                  <b className="font-display text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-text-secondary">
                    Antes
                  </b>
                  <time className="text-[11px] leading-[14px] text-text-tertiary">
                    {shortDate(userMovie.note_before_at)}
                  </time>
                </div>
                <p className="type-body-md text-text-secondary">{userMovie.note_before}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-[9px] py-1 text-[10.5px] leading-[14px] text-text-tertiary">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" stroke="currentColor" fill="none" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                  Esta nota ya no se puede editar
                </div>
              </div>

              <div className="relative pl-6">
                <span className="absolute top-1 left-0 h-3 w-3 rounded-full border-[1.5px] border-accent bg-accent" />
                <div className="mb-2 flex items-baseline gap-2">
                  <b className="font-display text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-accent-text">
                    Después
                  </b>
                  <time className="text-[11px] leading-[14px] text-text-tertiary">Hoy</time>
                </div>
                <textarea
                  value={noteAfter}
                  onChange={(e) => setNoteAfter(e.target.value)}
                  placeholder="¿Qué te pareció? Podés compararla con lo que esperabas."
                  className="type-body-md min-h-[116px] w-full resize-none rounded-md border border-accent bg-surface-med p-3 text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-baseline gap-2">
                <b className="font-display text-[11px] leading-[14px] font-semibold tracking-[-0.005em] text-accent-text">
                  Después
                </b>
                <time className="text-[11px] leading-[14px] text-text-tertiary">Hoy</time>
              </div>
              <textarea
                value={noteAfter}
                onChange={(e) => setNoteAfter(e.target.value)}
                placeholder="¿Qué te pareció?"
                className="type-body-md min-h-[116px] w-full resize-none rounded-md border border-accent bg-surface-med p-3 text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-4 pt-6">
          {userMovie.note_before && (
            <PublishRow
              label="Publicar la nota de antes"
              caption="Se muestra con su fecha original. No se puede editar."
              on={publishBefore}
              onToggle={() => setPublishBefore((v) => !v)}
              first
            />
          )}
          <PublishRow
            label="Publicar la nota de después"
            caption="Aparece en la ficha de la película y en tu perfil."
            on={publishAfter}
            onToggle={() => setPublishAfter((v) => !v)}
            first={!userMovie.note_before}
            last
          />
        </div>

        <div className="h-8" />
      </div>

      <div className="border-t border-border-subtle bg-bg px-4 pt-3 pb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-md bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Marcar como vista'}
        </button>
      </div>
    </div>
  )
}

function PublishRow({ label, caption, on, onToggle, first, last }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-border-subtle py-4 ${first ? 'border-t' : ''} ${last ? 'border-b' : ''}`}
    >
      <div>
        <div className="type-label">{label}</div>
        <div className="type-caption mt-1 text-text-tertiary">{caption}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="relative h-[26px] w-11 flex-none rounded-full border"
        style={{
          background: on ? 'var(--color-accent)' : 'var(--color-surface-high)',
          borderColor: on ? 'var(--color-accent)' : 'var(--color-border)',
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full transition-[left]"
          style={{
            left: on ? '22px' : '2px',
            background: on ? '#fff' : 'var(--color-text-tertiary)',
          }}
        />
      </button>
    </div>
  )
}
