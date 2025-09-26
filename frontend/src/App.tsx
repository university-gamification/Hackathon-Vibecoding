import { useEffect, useState } from 'react'
import { api } from './api'

function App() {
  const [status, setStatus] = useState('')

  useEffect(() => {
    api('/api/health')
      .then(res => setStatus(res.status))
      .catch(() => setStatus('unavailable'))
  }, [])

  return (
    <div className="container">
      <h1>Hackathon-09-26</h1>
      <p>Backend status: <strong>{status || 'checking...'}</strong></p>
      <section>
        <h2>Echo test</h2>
        <Echo />
      </section>
    </div>
  )
}

function Echo() {
  const [msg, setMsg] = useState('Hello world')
  const [reply, setReply] = useState('')

  async function send() {
    const data = await api(`/api/echo?msg=${encodeURIComponent(msg)}`)
    setReply(data.reply)
  }

  return (
    <div className="card">
      <input value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send}>Send</button>
      {reply && <p>Reply: {reply}</p>}
    </div>
  )
}

export default App
