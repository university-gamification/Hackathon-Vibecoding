import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="home">
      <header className="hero">
        <h1>All your knowledge. One place.</h1>
        <p>
          Store and group your articles, files, presentations, books, and websites in one secure place.
          We’ll organize them into a unified datalake, vectorize your content, and power a RAG system for
          smarter search and assessments.
        </p>
        <div className="cta">
          <Link className="btn" to="/signup">Get started — it’s free</Link>
        </div>
      </header>

      <section className="benefits">
        <div className="grid">
          <div>
            <h3>Unified storage</h3>
            <p>Upload files of many types and keep them organized per user.</p>
          </div>
          <div>
            <h3>Vectorized knowledge</h3>
            <p>We vectorize your documents to enable high-quality retrieval.</p>
          </div>
          <div>
            <h3>RAG-ready</h3>
            <p>Build your Retrieval-Augmented Generation index in one click.</p>
          </div>
          <div>
            <h3>Assess text</h3>
            <p>Grade a piece of text using your own knowledge base.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
