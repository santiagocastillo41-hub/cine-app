import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

// Andamiaje temporal. A propósito sin estilo: esto se reemplaza por
// las pantallas de auth diseñadas en docs/ más adelante.
export default function LoginPage() {
  const { session, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const { error } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password, username)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div style={{ padding: 24, maxWidth: 360, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>[ andamiaje temporal, sin diseñar ]</h1>
      <p>{mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</p>

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <p>
            <label>
              username
              <br />
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
          </p>
        )}
        <p>
          <label>
            email
            <br />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            contraseña
            <br />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
        </p>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? 'un momento…' : mode === 'signin' ? 'entrar' : 'crear cuenta'}
        </button>
      </form>

      <p>
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? '¿no tenés cuenta? crear una' : '¿ya tenés cuenta? entrar'}
        </button>
      </p>
    </div>
  )
}
