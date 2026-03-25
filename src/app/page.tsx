import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '560px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
          BLACK BOX<br />MAGIC
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
          AI-powered image analysis for retail execution. Upload a photo, get structured intelligence in seconds.
        </p>
        <Link className="btn btn--primary" style={{ display: 'inline-flex', fontSize: '1rem', padding: '1rem 2.5rem' }} href="/demo">
          TRY THE DEMO
        </Link>
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          <span>7 facets</span>
          <span>/</span>
          <span>Adaptive</span>
          <span>/</span>
          <span>AI Vision</span>
        </div>
      </div>
    </div>
  );
}
