'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import { GateScreen } from './gate';
import { ExportMenu } from './export-menu';
import type { AnalysisResponse } from '@/types/analysis';
import { SAMPLE_QSR_RESULT } from '@/lib/sample-qsr-result';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const PARALLEL_LIMIT = 2;

interface ImageJob {
  id: string;
  fileName: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: AnalysisResponse;
  error?: string;
  startedAt?: number;
  elapsed?: number;
  logId?: string;
}

export default function DemoPage() {
  const gate = useEmailGate();
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [activeId, setActiveId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Gate: show loading spinner or gate screen
  if (gate.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!gate.email) {
    return <GateScreen onSubmit={gate.submitEmail} error={gate.error} loading={gate.loading} />;
  }

  const activeJob = jobs.find(j => j.id === activeId);
  const hasResults = jobs.some(j => j.status === 'done' || j.status === 'error');

  const addFiles = useCallback((files: FileList) => {
    const valid = Array.from(files).filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE);
    if (!valid.length) return;

    // Enforce max images limit
    const currentCount = jobs.length;
    const allowed = valid.slice(0, MAX_IMAGES - currentCount);
    if (!allowed.length) return;

    const newJobs: ImageJob[] = allowed.map(f => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      previewUrl: URL.createObjectURL(f),
      base64: '',
      mimeType: f.type,
      status: 'pending' as const,
    }));

    allowed.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setJobs(prev => prev.map(j => j.id === newJobs[idx].id ? { ...j, base64: b64 } : j));
      };
      reader.readAsDataURL(file);
    });

    setJobs(prev => [...prev, ...newJobs]);
    setActiveId(newJobs[0].id);
  }, [jobs.length]);

  const removeJob = (id: string) => {
    setJobs(prev => {
      const job = prev.find(j => j.id === id);
      if (job) URL.revokeObjectURL(job.previewUrl);
      const next = prev.filter(j => j.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[0].id);
      if (!next.length) setActiveId('');
      return next;
    });
  };

  const clearAll = () => {
    jobs.forEach(j => URL.revokeObjectURL(j.previewUrl));
    setJobs([]);
    setActiveId('');
    setIsAnalyzing(false);
  };

  const analyzeOne = async (job: ImageJob) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'analyzing' as const, startedAt: Date.now() } : j));
    try {
      const res = await fetch('/api/demo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: job.base64, mime_type: job.mimeType, fileName: job.fileName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done' as const, result: data, logId: data.log_id || undefined, elapsed: Date.now() - (j.startedAt || Date.now()), base64: '' } : j));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error' as const, error: msg, elapsed: Date.now() - (j.startedAt || Date.now()), base64: '' } : j));
    }
  };

  const analyzeAll = async () => {
    setIsAnalyzing(true);
    const pending = jobs.filter(j => j.status === 'pending' && j.base64);
    for (let i = 0; i < pending.length; i += PARALLEL_LIMIT) {
      const batch = pending.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(batch.map(analyzeOne));
    }
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (!jobs.some(j => j.status === 'analyzing')) return;
    const iv = setInterval(() => {
      setJobs(prev => prev.map(j =>
        j.status === 'analyzing' && j.startedAt ? { ...j, elapsed: Date.now() - j.startedAt } : j
      ));
    }, 1000);
    return () => clearInterval(iv);
  }, [jobs]);

  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const canAnalyze = jobs.some(j => j.status === 'pending' && j.base64);

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: '0.875rem', fontWeight: 900, textDecoration: 'none', color: 'var(--text)', letterSpacing: '0.05em' }}>BLACK BOX MAGIC</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="user-bar">
            <span className="user-bar__email">{gate.email}</span>
            <button className="user-bar__logout" onClick={gate.clearSession}>no eres tú?</button>
          </div>
          <span className="badge badge--neutral">DEMO</span>
        </div>
      </header>

      {/* Upload area */}
      {!isAnalyzing && !hasResults && (
        <>
          <div
            className={`drop-zone${dragActive ? ' drop-zone--active' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            style={{ marginBottom: '1rem' }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
              {jobs.length === 0 ? 'Selecciona o arrastra fotos de punto de venta' : `${jobs.length} imagen${jobs.length > 1 ? 'es' : ''} seleccionada${jobs.length > 1 ? 's' : ''}`}
            </div>
            <div className="text-sm muted">JPG, PNG, WebP — máx 10 MB — hasta {MAX_IMAGES} imágenes</div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
          </div>

          {/* Example button */}
          {jobs.length === 0 && (
            <button
              className="btn btn--secondary"
              onClick={() => {
                const sampleJob: ImageJob = {
                  id: 'sample-qsr',
                  fileName: 'ejemplo-restaurante.jpg',
                  previewUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" fill="%231A1A2E"><rect width="180" height="180" fill="%23f0f0f0"/><text x="90" y="85" text-anchor="middle" font-size="14" fill="%23666">Fachada</text><text x="90" y="105" text-anchor="middle" font-size="14" fill="%23666">Restaurante QSR</text></svg>'),
                  base64: '',
                  mimeType: 'image/jpeg',
                  status: 'done',
                  result: SAMPLE_QSR_RESULT,
                  elapsed: 4200,
                };
                setJobs([sampleJob]);
                setActiveId('sample-qsr');
              }}
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', marginBottom: '1rem' }}
            >
              VER EJEMPLO — Auditoría de Restaurante QSR
            </button>
          )}

          {/* Thumbnails */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {jobs.map(j => (
                <div key={j.id} style={{ position: 'relative', width: 72, height: 72, border: '2px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={j.previewUrl} alt={j.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button onClick={e => { e.stopPropagation(); removeJob(j.id); }} style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, background: 'var(--text)', color: 'var(--bg-white)', border: 'none', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons — inline, always visible after thumbnails */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn--primary" onClick={analyzeAll} disabled={!canAnalyze} style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}>
                {canAnalyze ? `ANALIZAR ${pendingCount} IMAGEN${pendingCount > 1 ? 'ES' : ''}` : 'CARGANDO...'}
              </button>
              <button className="btn btn--secondary" onClick={clearAll} style={{ padding: '1rem', fontSize: '0.8rem' }}>LIMPIAR</button>
            </div>
          )}
        </>
      )}

      {/* Analyzing spinner */}
      {isAnalyzing && !hasResults && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Analizando {jobs.length} imagen{jobs.length > 1 ? 'es' : ''}...</p>
          <p className="muted text-sm mt-1">Puede tomar hasta 60 segundos por imagen</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn--secondary btn--small" onClick={() => fileRef.current?.click()}>+ AGREGAR IMÁGENES</button>
            {pendingCount > 0 && (
              <button className="btn btn--primary btn--small" onClick={analyzeAll} disabled={isAnalyzing || !canAnalyze}>
                {isAnalyzing ? 'ANALIZANDO...' : `ANALIZAR ${pendingCount} NUEVA${pendingCount > 1 ? 'S' : ''}`}
              </button>
            )}
            <button className="btn btn--secondary btn--small" onClick={clearAll}>LIMPIAR TODO</button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
          </div>

          {/* Tabs */}
          {jobs.length > 1 && (
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              {jobs.map(j => (
                <button key={j.id} className={`tab${j.id === activeId ? ' tab--active' : ''}`} onClick={() => setActiveId(j.id)}>
                  <img src={j.previewUrl} alt="" style={{ width: 24, height: 24, objectFit: 'cover', border: '1px solid var(--border-light)' }} />
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.fileName}</span>
                  <StatusDot status={j.status} />
                </button>
              ))}
            </div>
          )}

          {/* Active job */}
          {activeJob && (
            <div>
              {activeJob.status === 'pending' && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                  <img src={activeJob.previewUrl} alt={activeJob.fileName} style={{ maxWidth: 180, maxHeight: 180, objectFit: 'contain', border: '2px solid var(--border)', marginBottom: '1rem' }} />
                  <p className="muted text-sm">Pendiente de análisis</p>
                </div>
              )}
              {activeJob.status === 'analyzing' && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 700 }}>Analizando...</p>
                  <p className="muted text-sm mt-1">{activeJob.elapsed ? `${Math.floor(activeJob.elapsed / 1000)}s` : '0s'} transcurridos</p>
                </div>
              )}
              {activeJob.status === 'error' && (
                <div className="card" style={{ borderColor: 'var(--accent-red)' }}>
                  <p style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.5rem' }}>Análisis fallido</p>
                  <p className="text-sm">{activeJob.error}</p>
                  <button className="btn btn--secondary btn--small" style={{ marginTop: '1rem' }} onClick={() => setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, status: 'pending' as const, error: undefined } : j))}>REINTENTAR</button>
                </div>
              )}
              {activeJob.status === 'done' && activeJob.result && (
                <ResultView job={activeJob} allDoneResults={jobs.filter(j => j.status === 'done' && j.result).map(j => j.result!)} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { pending: 'var(--border-light)', analyzing: 'var(--accent-yellow)', done: 'var(--accent-green)', error: 'var(--accent-red)' };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block', flexShrink: 0 }} />;
}

// ─── Result View ───

function ResultView({ job, allDoneResults }: { job: ImageJob; allDoneResults: AnalysisResponse[] }) {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const sendEmail = async () => {
    if (!job.logId) return;
    setEmailStatus('sending');
    try {
      const res = await fetch('/api/demo/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: job.logId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      setEmailStatus('sent');
      setTimeout(() => setEmailStatus('idle'), 3000);
    } catch {
      setEmailStatus('error');
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
  };
  const { result } = job;
  if (!result) return null;
  const a = result.analysis;
  const meta = result.meta;

  const typeBadgeColor = {
    condition: 'badge--red',
    retail_shelf: 'badge--blue',
    facade: 'badge--neutral',
    promotional: 'badge--yellow',
    equipment: 'badge--neutral',
    general: 'badge--neutral',
  }[a.photo_type || 'general'] || 'badge--neutral';

  const severityBadge = a.severity && a.severity !== 'N/A'
    ? a.severity === 'CRITICAL' ? 'badge--red' : a.severity === 'MODERATE' ? 'badge--yellow' : 'badge--green'
    : null;

  return (
    <div>
      {/* Header card */}
      <div className="card" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <img src={job.previewUrl} alt={job.fileName} style={{ width: 180, height: 180, objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Score + Badges row */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {typeof a.execution_score === 'number' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: '50%', fontWeight: 900, fontSize: '1.1rem',
                color: '#fff',
                background: a.execution_score >= 90 ? 'var(--accent-green)' : a.execution_score >= 70 ? '#2196F3' : a.execution_score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
              }}>{a.execution_score}</span>
            )}
            <span className="badge badge--green">COMPLETO</span>
            {a.photo_type && <span className={`badge ${typeBadgeColor}`}>{a.photo_type.replace('_', ' ')}</span>}
            {severityBadge && <span className={`badge ${severityBadge}`}>{a.severity}</span>}
            {meta.escalated && <span className="badge badge--red">ESCALADO</span>}
          </div>

          {/* Score label */}
          {typeof a.execution_score === 'number' && (
            <div className="text-xs mb-1" style={{ fontWeight: 700, color: a.execution_score >= 70 ? 'var(--accent-green)' : a.execution_score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
              Puntuación de ejecución: {a.execution_score}/100
            </div>
          )}

          {/* Priority facets */}
          {a.priority_facets && a.priority_facets.length > 0 && (
            <div className="text-xs muted mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Prioridad: {a.priority_facets.join(' → ')}
            </div>
          )}

          <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{a.summary || 'Sin resumen disponible'}</p>

          <div className="text-xs muted mt-2 mono">
            {meta.tokens.total} tokens · {(meta.processing_time_ms / 1000).toFixed(1)}s · {meta.engine || 'v1'}
            {meta.escalated && ' · 2-pass'}
          </div>

          {/* Export + Email buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <ExportMenu
              result={result}
              imageUrl={job.previewUrl}
              fileName={job.fileName.replace(/\.[^.]+$/, '')}
              allResults={allDoneResults}
            />
            {job.logId && (
              <button
                className="btn btn--secondary btn--small"
                onClick={sendEmail}
                disabled={emailStatus === 'sending' || emailStatus === 'sent'}
                style={{ fontSize: '0.75rem' }}
              >
                {emailStatus === 'idle' && 'EMAIL'}
                {emailStatus === 'sending' && 'ENVIANDO...'}
                {emailStatus === 'sent' && 'ENVIADO \u2713'}
                {emailStatus === 'error' && 'ERROR \u2014 REINTENTAR'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Truncation warning */}
      {meta.truncated && (
        <div className="truncation-banner mt-2">
          El análisis identificó más items de los que se pudieron procesar.
          Se muestran {a.inventory?.items?.length ?? 0} de ~{a.inventory?.total_skus_detected ?? '?'} estimados.
        </div>
      )}

      {/* Facets */}
      <div className="card mt-2">
        <Collapsible title="Inventario" defaultOpen>
          <InventorySection data={a.inventory} />
        </Collapsible>
        <Collapsible title="Participación en Anaquel">
          <ShelfShareSection data={a.shelf_share} />
        </Collapsible>
        <Collapsible title="Precios">
          <PricingSection data={a.pricing} />
        </Collapsible>
        <Collapsible title="Cumplimiento">
          <ComplianceSection data={a.compliance} />
        </Collapsible>
        <Collapsible title="Condición">
          <ConditionSection data={a.condition} />
        </Collapsible>
        <Collapsible title="Contexto">
          <ContextSection data={a.context} />
        </Collapsible>
        <Collapsible title="Insights y Recomendaciones">
          <InsightsSection data={a.insights} />
        </Collapsible>

        {/* Additional observations */}
        {a.additional_observations && (
          <Collapsible title="Observaciones Adicionales">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{a.additional_observations}</p>
          </Collapsible>
        )}

        {/* Condition Detail (escalated) */}
        {result.condition_detail && (
          <Collapsible title="Detalle de Condición (Escalado)" defaultOpen>
            <ConditionDetailSection data={result.condition_detail} />
          </Collapsible>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible ───

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="collapsible">
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

// ─── Section renderers ───

function InventorySection({ data }: { data?: AnalysisResponse['analysis']['inventory'] }) {
  if (!data?.items?.length) return <p className="muted text-sm">Sin productos detectados</p>;
  return (
    <>
      <div className="text-xs muted mb-1">{data.total_skus_detected} SKUs detectados</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Producto</th><th>Marca</th><th>Cant.</th></tr></thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i}><td>{item.name}</td><td>{item.brand || '—'}</td><td>{item.quantity}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ShelfShareSection({ data }: { data?: AnalysisResponse['analysis']['shelf_share'] }) {
  if (!data?.brands?.length) return <p className="muted text-sm">Sin datos</p>;
  return (
    <>
      {data.dominant_brand && <div className="text-xs mb-1">Dominante: <strong>{data.dominant_brand}</strong></div>}
      {data.brands.map((b, i) => (
        <div key={i} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 2 }}>
            <span>{b.name}</span>
            <span className="mono" style={{ fontWeight: 700 }}>{b.estimated_share_pct}%</span>
          </div>
          <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${Math.min(b.estimated_share_pct, 100)}%` }} /></div>
        </div>
      ))}
      {data.notes && <p className="text-xs muted mt-1">{data.notes}</p>}
    </>
  );
}

function PricingSection({ data }: { data?: AnalysisResponse['analysis']['pricing'] }) {
  if (!data?.prices_found?.length) return <p className="muted text-sm">Sin precios detectados</p>;
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Artículo</th><th>Precio</th><th>Tipo</th></tr></thead>
          <tbody>
            {data.prices_found.map((p, i) => (
              <tr key={i}>
                <td>{p.item}</td>
                <td className="mono" style={{ fontWeight: 700 }}>{p.currency || '$'}{p.price}</td>
                <td>{p.type ? <span className="badge badge--neutral">{p.type}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.strategies_detected && data.strategies_detected.length > 0 && (
        <div className="mt-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {data.strategies_detected.map((s, i) => <span key={i} className="badge badge--blue">{s}</span>)}
        </div>
      )}
    </>
  );
}

function ComplianceSection({ data }: { data?: AnalysisResponse['analysis']['compliance'] }) {
  if (!data) return <p className="muted text-sm">Sin datos</p>;
  const color = data.score === 'HIGH' ? 'badge--green' : data.score === 'MEDIUM' ? 'badge--yellow' : 'badge--red';
  const scoreLabel = data.score === 'HIGH' ? 'ALTO' : data.score === 'MEDIUM' ? 'MEDIO' : 'BAJO';
  return (
    <>
      <div style={{ marginBottom: '1rem' }}><span className={`badge ${color}`}>{scoreLabel}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div>Frenteo: <strong>{data.product_facing}</strong></div>
        <div>Señalización: <strong>{data.signage}</strong></div>
        <div>Material POP: <strong>{data.pop_materials?.present ? 'Sí' : 'No'}</strong></div>
        <div>Condición POP: <strong>{data.pop_materials?.condition || '—'}</strong></div>
      </div>
      {data.issues && data.issues.length > 0 && (
        <div className="mt-2">
          <div className="text-xs" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Problemas:</div>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {data.issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}

function ConditionSection({ data }: { data?: AnalysisResponse['analysis']['condition'] }) {
  if (!data) return <p className="muted text-sm">Sin datos</p>;
  const fields = [
    { label: 'Limpieza', value: data.cleanliness },
    { label: 'Exhibidores', value: data.displays },
    { label: 'Iluminación', value: data.lighting },
    { label: 'Productos', value: data.products },
  ];
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        {fields.map(f => <div key={f.label}>{f.label}: <strong>{f.value}</strong></div>)}
      </div>
      {data.safety_issues && data.safety_issues.length > 0 && (
        <div className="mt-1 text-xs" style={{ color: 'var(--accent-red)' }}>Seguridad: {data.safety_issues.join(', ')}</div>
      )}
      {data.notes && <p className="text-xs muted mt-1">{data.notes}</p>}
    </>
  );
}

function ContextSection({ data }: { data?: AnalysisResponse['analysis']['context'] }) {
  if (!data) return <p className="muted text-sm">Sin datos</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
      <div>Tipo: <strong>{data.establishment_type}</strong></div>
      <div>Entorno: <strong>{data.setting}</strong></div>
      <div>Ubicación: <strong>{data.inferred_location?.city_or_region || '—'}, {data.inferred_location?.country || '—'}</strong></div>
      <div>Confianza: <strong>{data.inferred_location?.confidence || '—'}</strong></div>
      <div>Hora: <strong>{data.time_of_day || '—'}</strong></div>
      <div>Tráfico: <strong>{data.foot_traffic}</strong></div>
    </div>
  );
}

function InsightsSection({ data }: { data?: AnalysisResponse['analysis']['insights'] }) {
  if (!data) return <p className="muted text-sm">No data</p>;
  const sections = [
    { title: 'Fortalezas', items: data.strengths, color: 'var(--accent-green)' },
    { title: 'Oportunidades', items: data.opportunities, color: 'var(--accent-blue)' },
    { title: 'Riesgos', items: data.threats, color: 'var(--accent-red)' },
    { title: 'Recomendaciones', items: data.recommendations, color: 'var(--text)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {sections.map(s => (
        <div key={s.title}>
          <div className="text-xs" style={{ fontWeight: 700, color: s.color, marginBottom: '0.25rem' }}>{s.title.toUpperCase()}</div>
          {s.items && s.items.length > 0
            ? <ul style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.items.map((item, i) => <li key={i} style={{ marginBottom: '0.15rem' }}>{item}</li>)}</ul>
            : <p className="text-xs muted">No identificados</p>}
        </div>
      ))}
    </div>
  );
}

// ─── NEW: Condition Detail (escalated) ───

function ConditionDetailSection({ data }: { data: NonNullable<AnalysisResponse['condition_detail']> }) {
  const severityColor = data.severity === 'CRITICAL' ? 'badge--red' : data.severity === 'MODERATE' ? 'badge--yellow' : 'badge--green';

  return (
    <div>
      {/* Severity header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span className={`badge ${severityColor}`}>{data.severity}</span>
        {data.severity_justification && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.severity_justification}</span>}
      </div>

      {/* Issues table */}
      {data.issues && data.issues.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Problemas Detectados</div>
          {data.issues.map((issue, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${issue.severity === 'CRITICAL' ? 'var(--accent-red)' : issue.severity === 'MODERATE' ? 'var(--accent-yellow)' : 'var(--border-light)'}`, paddingLeft: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="text-sm" style={{ fontWeight: 700 }}>{issue.description}</div>
              {issue.location && <div className="text-xs muted">Ubicación: {issue.location}</div>}
              {issue.root_cause && <div className="text-xs muted">Causa: {issue.root_cause}</div>}
              {issue.immediate_action && <div className="text-xs" style={{ color: 'var(--accent-blue)' }}>Acción: {issue.immediate_action}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Safety hazards */}
      {data.safety_hazards && data.safety_hazards.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-red)' }}>Riesgos de Seguridad</div>
          {data.safety_hazards.map((h, i) => (
            <div key={i} className="text-sm" style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>[{h.risk_level}]</span> {h.hazard}
              {h.mitigation && <span className="muted"> — {h.mitigation}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Remediation plan */}
      {data.remediation_plan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { title: 'Inmediato', items: data.remediation_plan.immediate, color: 'var(--accent-red)' },
            { title: 'Corto Plazo', items: data.remediation_plan.short_term, color: 'var(--accent-yellow)' },
            { title: 'Preventivo', items: data.remediation_plan.preventive, color: 'var(--accent-green)' },
          ].map(col => (
            <div key={col.title}>
              <div className="text-xs" style={{ fontWeight: 700, color: col.color, marginBottom: '0.25rem' }}>{col.title.toUpperCase()}</div>
              {col.items && col.items.length > 0
                ? <ul style={{ paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{col.items.map((item, i) => <li key={i} style={{ marginBottom: '0.15rem' }}>{item}</li>)}</ul>
                : <p className="text-xs muted">—</p>}
            </div>
          ))}
        </div>
      )}

      {/* Overall assessment */}
      {data.overall_assessment && (
        <div style={{ background: 'var(--bg)', padding: '0.75rem 1rem', borderLeft: '3px solid var(--border)', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {data.overall_assessment}
        </div>
      )}
    </div>
  );
}
