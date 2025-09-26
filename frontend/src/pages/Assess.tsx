import { FormEvent, useState } from 'react'
import { assess } from '../api'

export default function Assess() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ grade: number; explanation: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await assess(text)
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Failed to assess text')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container narrow">
      <h1>Assess a text with your RAG</h1>
      <p>Paste any text below. We will score it (1–10) based on your knowledge base.</p>
      <form onSubmit={onSubmit} className="form">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder="Paste text here..." required />
        <button className="btn" disabled={loading}>{loading ? 'Assessing…' : 'Assess'}</button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result">
          <h2>Grade: {result.grade.toFixed(1)} / 10</h2>
          <p>{result.explanation}</p>
        </div>
      )}
    </div>
  )
}
