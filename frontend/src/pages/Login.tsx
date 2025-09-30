import { FormEvent, useState } from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'

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
        setError(`Login failed (${err.status}) at ${err.url}. Response: ${err.body}`)
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
