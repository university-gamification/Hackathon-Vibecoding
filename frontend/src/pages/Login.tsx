import { FormEvent, useState } from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'

/**
 * Render a sign-in form and handle user authentication.
 *
 * Attempts to authenticate with the provided email and password; on success navigates to `/dashboard`.
 * While the request is in progress the submit button is disabled. If authentication fails, displays an error message.
 * If the error is an `ApiError`, the UI shows a brief message containing the HTTP status only
 * (e.g., "Login failed (STATUS). Please check your credentials and try again."),
 * and logs the full technical details (status, request URL, response body) to the console for debugging.
 * For non-`ApiError` cases, it shows the error message or a generic failure message.
 *
 * @returns The React element containing the sign-in form, controls for email and password, loading state, and error display.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      if (err instanceof ApiError) {
        // Log full technical details for developers
        console.error('Login error', { status: err.status, url: err.url, body: err.body });
        // Show a concise, user-friendly message without internal URLs or bodies
        setError(`Login failed (${err.status}). Please check your credentials and try again.`)
      } else {
        setError(err?.message || 'Failed to log in')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container narrow">
      <h1>Welcome back</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <pre className="error" style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>}
        <button className="btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  )
}
