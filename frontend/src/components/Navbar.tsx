import { Link, useNavigate } from 'react-router-dom'
import { getToken, getEmail, logout as doLogout } from '../api'

export function Navbar() {
  const token = getToken()
  const email = getEmail()
  const navigate = useNavigate()

  function handleLogout() {
    doLogout()
    navigate('/')
  }

  return (
    <nav className="nav">
      <Link to="/" className="brand">KnowledgeHub</Link>
      <div className="spacer" />
      <div className="links">
        {token ? (
          <>
            <span>{email}</span>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/assess">Assess</Link>
            <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/signup">Sign up</Link>
            <Link to="/login">Log in</Link>
          </>
        )}
      </div>
    </nav>
  )
}
