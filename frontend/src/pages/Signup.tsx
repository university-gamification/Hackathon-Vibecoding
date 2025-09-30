import { FormEvent, useState } from 'react'
import { register, login } from '../api'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'

/**
 * Render a signup page and handle creating a new user, signing them in, and navigating to the dashboard.
 *
 * Displays a form with email and password inputs, shows API error details when signup fails,
 * and disables the submit button while the request is in progress.
 *
 * @returns The JSX element for the signup page containing the form, error display, and submit button.
 */
export default function Signup() {
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
      await register(email, password)
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(`Signup failed (${err.status}) at ${err.url}. Response: ${err.body}`)
      } else {
        setError(err?.message || 'Failed to sign up')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container narrow">
      <h1>Create your account</h1>
      <p>Sign up to upload knowledge sources and build your RAG.</p>
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
        <button className="btn" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
      </form>
    </div>
  )
}
