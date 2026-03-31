'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import { GateScreen } from '@/app/demo/gate';
import type { ComparisonResult, ReferenceType } from '@/types/comparison';

/* ── Constants ──────────────────────────────────────────────── */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const REFERENCE_OPTIONS: { value: ReferenceType; label: string }[] = [
  { value: 'planogram', label: 'Planograma de productos' },
  { value: 'brand_manual', label: 'Manual de marca' },
  { value: 'checklist', label: 'Checklist normativo' },
  { value: 'blueprint', label: 'Plano o especificación' },
];

type PageState = 'idle' | 'uploading' | 'ready' | 'analyzing' | 'done' | 'error';

interface ImageSlot {
  file: File | null;
  previewUrl: string | null;
  dataUrl: string | null;
}

const emptySlot: ImageSlot = { file: null, previewUrl: null, dataUrl: null };

/* ── Helpers ────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreColorVar(score: number): string {
  if (score >= 80) return 'var(--accent-green)';
  if (score >= 60) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

function scoreBadge(score: number): string {
  if (score >= 80) return 'badge--green';
  if (score >= 60) return 'badge--yellow';
  return 'badge--red';
}

/* ── Toast ──────────────────────────────────────────────────── */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, background: 'var(--text)', color: 'var(--bg-white)',
      padding: '0.75rem 1.25rem', border: '2px solid var(--border)',
      fontSize: '0.8rem', fontWeight: 700,
    }}>
      {message}
    </div>
  );
}

/* ── Upload Zone ────────────────────────────────────────────── */

function UploadZone({ label, hint, slot, onSelect, onClear }: {
  label: string; hint: string; slot: ImageSlot;
  onSelect: (file: File) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!ACCEPTED_TYPES.includes(f.type) || f.size > MAX_SIZE) return;
    onSelect(f);
  }, [onSelect]);

  if (slot.previewUrl) {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <img
          src={slot.previewUrl}
          alt={slot.file?.name || label}
          style={{ width: '100%', height: 200, objectFit: 'contain', background: 'var(--bg)', display: 'block' }}
        />
        <div style={{
          padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.file?.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {slot.file ? formatBytes(slot.file.size) : ''}
            </div>
          </div>
          <button
            className="btn btn--secondary btn--small"
            onClick={() => { onClear(); inputRef.current?.click(); }}
          >
            Cambiar
          </button>
        </div>
        <input
          ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
    );
  }

  return (
    <div
      className={`drop-zone${dragActive ? ' drop-zone--active' : ''}`}
      style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
    >
      <div style={{ fontSize: '2rem' }}>{label === 'Referencia' ? '📋' : '📷'}</div>
      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{label}</div>
      <div className="text-sm muted" style={{ textAlign: 'center', padding: '0 1rem' }}>{hint}</div>
      <div className="text-xs muted" style={{ marginTop: '0.25rem' }}>JPG, PNG, WebP &mdash; máx 5 MB</div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

/* ── Collapsible Section ──────────────────────────────────── */

function CollapsibleSection({ title, count, children, defaultOpen = false }: {
  title: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div className="collapsible">
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <span>{title} <span className="badge badge--neutral" style={{ marginLeft: '0.5rem' }}>{count}</span></span>
        <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>&#9660;</span>
      </div>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function ComparePage() {
  const gate = useEmailGate();

  const [reference, setReference] = useState<ImageSlot>(emptySlot);
  const [field, setField] = useState<ImageSlot>(emptySlot);
  const [refType, setRefType] = useState<ReferenceType>('planogram');
  const [pageState, setPageState] = useState<PageState>('idle');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState('');

  /* Token bypass */
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('token')) setHasToken(true);
  }, []);

  /* Derive state */
  const bothReady = !!(reference.dataUrl && field.dataUrl);
  useEffect(() => {
    if (pageState === 'idle' || pageState === 'uploading') {
      if (bothReady) setPageState('ready');
      else if (reference.file || field.file) setPageState('uploading');
      else setPageState('idle');
    }
  }, [reference, field, bothReady, pageState]);

  /* File selection */
  const selectFile = useCallback((slot: 'reference' | 'field', file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const setter = slot === 'reference' ? setReference : setField;
      setter((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl, dataUrl };
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearSlot = useCallback((slot: 'reference' | 'field') => {
    const setter = slot === 'reference' ? setReference : setField;
    setter((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return emptySlot;
    });
    setPageState('idle');
    setResult(null);
    setErrorMsg('');
  }, []);

  /* Compare */
  const runComparison = useCallback(async () => {
    if (!reference.dataUrl || !field.dataUrl) return;
    setPageState('analyzing');
    setErrorMsg('');
    setResult(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceImage: reference.dataUrl,
          fieldImage: field.dataUrl,
          referenceType: refType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error HTTP ${res.status}`);
      }
      setResult(data.result as ComparisonResult);
      setPageState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido');
      setPageState('error');
    }
  }, [reference.dataUrl, field.dataUrl, refType]);

  /* Reset */
  const resetAll = useCallback(() => {
    setReference((prev) => { if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl); return emptySlot; });
    setField((prev) => { if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl); return emptySlot; });
    setResult(null);
    setErrorMsg('');
    setPageState('idle');
  }, []);

  /* Clipboard export */
  const copyToClipboard = useCallback(() => {
    if (!result) return;
    const m = result.metrics;
    const lines = [
      `COMPARACIÓN DE REFERENCIA — Black Box Magic`,
      `${'='.repeat(45)}`,
      ``,
      `Cumplimiento general: ${result.complianceScore}%`,
      ``,
      `Métricas:`,
      `  Surtido:   ${m.assortment}% (${m.totalFound}/${m.totalExpected} encontrados)`,
      `  Posición:  ${m.positioning}% (${m.totalCorrectPosition}/${m.totalFound} correctos)`,
      `  Precios:   ${m.pricing}% (${m.totalPriceMatch}/${m.totalPriceVisible} coinciden)`,
      `  Huecos:    ${m.gaps} posiciones vacías`,
      ``,
      `Resumen: ${result.summary}`,
      ``,
      `Productos encontrados: ${result.matches.length}`,
      `Productos faltantes: ${result.missing.length}`,
      `Discrepancias de precio: ${result.priceDiscrepancies.length}`,
      `Productos inesperados: ${result.unexpected.length}`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setToast('Copiado al portapapeles');
    });
  }, [result]);

  const showComingSoon = useCallback((feature: string) => {
    setToast(`${feature} — Próximamente`);
  }, []);

  /* ── Auth Gate ──────────────────────────────────────────── */

  if (!hasToken && gate.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!hasToken && !gate.email) {
    return <GateScreen onSubmit={gate.submitEmail} error={gate.error} loading={gate.loading} />;
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)',
      }}>
        <Link href="/" style={{ fontSize: '0.875rem', fontWeight: 900, textDecoration: 'none', color: 'var(--text)', letterSpacing: '0.05em' }}>
          BLACK BOX MAGIC
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {gate.email && (
            <div className="user-bar">
              <span className="user-bar__email">{gate.email}</span>
              <button className="user-bar__logout" onClick={gate.clearSession}>salir</button>
            </div>
          )}
          <span className="badge badge--blue">COMPARAR</span>
        </div>
      </header>

      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.02em' }}>Comparación de referencia</h1>
        <p className="text-sm muted" style={{ marginTop: '0.25rem' }}>
          Sube una referencia y una foto de campo para evaluar el cumplimiento
        </p>
      </div>

      {/* Upload grid */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {/* Reference */}
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Referencia
          </label>
          <UploadZone
            label="Referencia"
            hint="Planograma, manual de marca, checklist o plano"
            slot={reference}
            onSelect={(f) => selectFile('reference', f)}
            onClear={() => clearSlot('reference')}
          />
          <select
            value={refType}
            onChange={(e) => setRefType(e.target.value as ReferenceType)}
            style={{
              width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.8rem',
              border: '2px solid var(--border)', background: 'var(--bg-white)',
              fontFamily: 'var(--font)', cursor: 'pointer',
            }}
          >
            {REFERENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Field photo */}
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Foto de campo
          </label>
          <UploadZone
            label="Foto de campo"
            hint="Foto real del anaquel, exhibición o punto de venta"
            slot={field}
            onSelect={(f) => selectFile('field', f)}
            onClear={() => clearSlot('field')}
          />
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          className="btn btn--primary"
          onClick={runComparison}
          disabled={!bothReady || pageState === 'analyzing'}
          style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}
        >
          {pageState === 'analyzing' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Analizando...
            </span>
          ) : 'COMPARAR'}
        </button>
        {pageState !== 'idle' && (
          <button
            className="btn btn--secondary"
            onClick={resetAll}
            disabled={pageState === 'analyzing'}
            style={{ padding: '1rem', fontSize: '0.8rem' }}
          >
            LIMPIAR
          </button>
        )}
      </div>

      {/* Error */}
      {pageState === 'error' && (
        <div className="card" style={{ borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ color: 'var(--accent-red)', fontSize: '1.25rem', flexShrink: 0 }}>&#9888;</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent-red)' }}>Error en la comparación</p>
              <p className="text-sm muted" style={{ marginTop: '0.25rem' }}>{errorMsg}</p>
              <button className="btn btn--secondary btn--small" onClick={runComparison} style={{ marginTop: '0.75rem' }}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {pageState === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Compliance score */}
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Cumplimiento general
            </p>
            <p style={{ fontSize: '4rem', fontWeight: 900, color: scoreColorVar(result.complianceScore), lineHeight: 1 }}>
              {result.complianceScore}<span style={{ fontSize: '2rem' }}>%</span>
            </p>
            {result.photoQuality === 'poor' && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', marginTop: '0.75rem' }}>
                Calidad de foto baja &mdash; los resultados pueden ser imprecisos
              </p>
            )}
            {result.coverage === 'partial' && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', marginTop: '0.25rem' }}>
                Cobertura parcial &mdash; no toda la referencia es visible en la foto
              </p>
            )}
          </div>

          {/* Metrics row */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <MetricCard label="Surtido" value={result.metrics.assortment} detail={`${result.metrics.totalFound}/${result.metrics.totalExpected} encontrados`} />
            <MetricCard label="Posición" value={result.metrics.positioning} detail={`${result.metrics.totalCorrectPosition}/${result.metrics.totalFound} correctos`} />
            <MetricCard label="Precios" value={result.metrics.pricing} detail={`${result.metrics.totalPriceMatch}/${result.metrics.totalPriceVisible} coinciden`} />
            <MetricCard label="Huecos" value={result.metrics.gaps} isCount detail="posiciones vacías" />
          </div>

          {/* Summary */}
          <div className="card">
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Resumen
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.summary}</p>
          </div>

          {/* Detail sections */}
          <div className="card" style={{ padding: '0 1.5rem' }}>
            <CollapsibleSection title="Productos encontrados" count={result.matches.length} defaultOpen>
              {result.matches.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: item.correctPosition ? 'var(--accent-green)' : 'var(--accent-yellow)', flexShrink: 0 }}>
                    {item.correctPosition ? '✓' : '○'}
                  </span>
                  <span>
                    {item.name}
                    {item.observation && <span className="muted"> &mdash; {item.observation}</span>}
                    {!item.correctPosition && <span style={{ color: 'var(--accent-yellow)' }}> (posición incorrecta)</span>}
                  </span>
                </div>
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Productos faltantes" count={result.missing.length}>
              {result.missing.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--accent-red)', flexShrink: 0 }}>✗</span>
                  <span>
                    {item.name}
                    {item.expectedPosition && <span className="muted"> &mdash; esperado en {item.expectedPosition}</span>}
                    {item.reason && <span className="muted"> ({item.reason})</span>}
                  </span>
                </div>
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Discrepancias de precio" count={result.priceDiscrepancies.length}>
              {result.priceDiscrepancies.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--accent-yellow)', flexShrink: 0 }}>$</span>
                  <span>
                    {item.name}
                    <span className="muted"> esperado ${item.expectedPrice.toFixed(2)} &rarr; visto ${item.observedPrice.toFixed(2)}</span>
                    <span style={{ color: item.difference > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {' '}({item.difference > 0 ? '+' : ''}{item.difference.toFixed(2)})
                    </span>
                  </span>
                </div>
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Productos inesperados" count={result.unexpected.length}>
              {result.unexpected.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>?</span>
                  <span>
                    {item.name}
                    {item.position && <span className="muted"> &mdash; en {item.position}</span>}
                    {item.observation && <span className="muted"> ({item.observation})</span>}
                  </span>
                </div>
              ))}
            </CollapsibleSection>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button className="btn btn--secondary btn--small" onClick={copyToClipboard}>📋 Copiar</button>
            <button className="btn btn--secondary btn--small" onClick={() => showComingSoon('Exportar PDF')}>📄 PDF</button>
            <button className="btn btn--secondary btn--small" onClick={() => showComingSoon('Exportar Excel')}>📊 Excel</button>
            <button className="btn btn--secondary btn--small" onClick={() => showComingSoon('Compartir por WhatsApp')}>📱 WhatsApp</button>
          </div>

          {/* New comparison */}
          <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
            <button
              onClick={resetAll}
              style={{
                background: 'none', border: 'none', fontSize: '0.8rem', fontFamily: 'var(--font)',
                color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Nueva comparación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function MetricCard({ label, value, detail, isCount = false }: {
  label: string; value: number; detail: string; isCount?: boolean;
}) {
  const color = isCount
    ? (value > 0 ? 'var(--accent-red)' : 'var(--accent-green)')
    : scoreColorVar(value);

  return (
    <div className="card" style={{ flex: '1 1 120px', textAlign: 'center', padding: '1rem' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1.1 }}>
        {value}{!isCount && <span style={{ fontSize: '1rem' }}>%</span>}
      </p>
      <p className="text-xs muted" style={{ marginTop: '0.25rem' }}>{detail}</p>
    </div>
  );
}
