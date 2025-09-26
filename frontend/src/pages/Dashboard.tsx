import { useEffect, useState } from 'react'
import { listFiles, uploadFiles, buildRag } from '../api'

export default function Dashboard() {
  const [files, setFiles] = useState<{ id: number; filename: string; created_at: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    try {
      const data = await listFiles()
      setFiles(data)
    } catch (e: any) {
      setMessage(e.message || 'Failed to list files')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onUploadSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files
    if (!f || f.length === 0) return
    setUploading(true)
    setMessage(null)
    try {
      const arr = Array.from(f)
      await uploadFiles(arr)
      setMessage('Upload complete')
      await refresh()
    } catch (e: any) {
      setMessage(e.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function onBuildRag() {
    setBuilding(true)
    setMessage(null)
    try {
      const res = await buildRag()
      setMessage(`RAG built: ${res.files_indexed ?? '?'} files indexed`)
    } catch (e: any) {
      setMessage(e.message || 'Failed to build RAG')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="container">
      <h1>Your Knowledge</h1>
      <p>Upload files to your personal space, then build your RAG index.</p>

      <div className="actions">
        <label className="btn">
          {uploading ? 'Uploading…' : 'Upload files'}
          <input type="file" multiple onChange={onUploadSelected} style={{ display: 'none' }} />
        </label>
        <button className="btn" onClick={onBuildRag} disabled={building}>
          {building ? 'Building…' : 'Build RAG'}
        </button>
      </div>

      {message && <p className="hint">{message}</p>}

      <h2>Recent uploads</h2>
      <ul className="list">
        {files.map(f => (
          <li key={f.id}>
            <span>{f.filename}</span>
            <small>{new Date(f.created_at).toLocaleString()}</small>
          </li>
        ))}
        {files.length === 0 && <li><em>No files yet</em></li>}
      </ul>
    </div>
  )
}
