'use client';

import { useState } from 'react';
import { ExportMenu } from '@/app/demo/export-menu';
import type { AnalysisResponse } from '@/types/analysis';

export interface ImageJob {
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

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { 
    pending: 'var(--border-light)', 
    analyzing: 'var(--accent-yellow)', 
    done: 'var(--accent-green)', 
    error: 'var(--accent-red)' 
  };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status], display: 'inline-block', flexShrink: 0 }} />;
}

// ─── Result View ───

export function ResultView({ 
  job, 
  allDoneResults 
}: { 
  job: ImageJob; 
  allDoneResults: AnalysisResponse[] 
}) {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const sendEmail = async () => {
    if (!job.logId) return;
    setEmailStatus('sending');
    try {
      // Convert preview image to base64 JPEG for email embedding
      let imageBase64: string | undefined;
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = job.previewUrl;
        });
        const canvas = document.createElement('canvas');
        const MAX = 600;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        imageBase64 = canvas.toDataURL('image/jpeg', 0.7);
      } catch { /* skip image if conversion fails */ }

      const res = await fetch('/api/demo/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: job.logId, image: imageBase64 }),
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
          {/* Badges row */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge badge--green">COMPLETO</span>
            {a.photo_type && <span className={`badge ${typeBadgeColor}`}>{a.photo_type.replace('_', ' ')}</span>}
            {severityBadge && <span className={`badge ${severityBadge}`}>{a.severity}</span>}
            {meta.escalated && <span className="badge badge--red">ESCALADO</span>}
          </div>

          {/* Priority facets */}
          {a.priority_facets && a.priority_facets.length > 0 && (
            <div className="text-xs muted mb-1" style={{ fontFamily: 'var(--mono)' }}>
              Prioridad: {a.priority_facets.join(' → ')}
            </div>
          )}

          <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{a.summary || 'Sin resumen disponible'}</p>

          <div className="text-xs muted mt-2 mono">
            {(meta.processing_time_ms / 1000).toFixed(1)}s · {meta.engine || 'v1'}
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
          El an&aacute;lisis identific&oacute; m&aacute;s items de los que se pudieron procesar.
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
        <Collapsible title="Hallazgos">
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

export function Collapsible({ 
  title, 
  defaultOpen, 
  children 
}: { 
  title: string; 
  defaultOpen?: boolean; 
  children: React.ReactNode 
}) {
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
          <thead><tr><th>Producto</th><th>Precio</th><th>Tipo</th></tr></thead>
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
  return (
    <>
      <div style={{ marginBottom: '1rem' }}><span className={`badge ${color}`}>{data.score}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div>Facing de producto: <strong>{data.product_facing}</strong></div>
        <div>Señalización: <strong>{data.signage}</strong></div>
        <div>Material POP: <strong>{data.pop_materials?.present ? 'Sí' : 'No'}</strong></div>
        <div>Estado POP: <strong>{data.pop_materials?.condition || '—'}</strong></div>
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
      <div>Tráfico peatonal: <strong>{data.foot_traffic}</strong></div>
    </div>
  );
}

function InsightsSection({ data }: { data?: AnalysisResponse['analysis']['insights'] }) {
  if (!data) return <p className="muted text-sm">Sin datos</p>;
  const sections = [
    { title: 'Fortalezas', items: data.strengths, color: 'var(--accent-green)' },
    { title: 'Oportunidades', items: data.opportunities, color: 'var(--accent-blue)' },
    { title: 'Amenazas', items: data.threats, color: 'var(--accent-red)' },
    { title: 'Recomendaciones', items: data.recommendations, color: 'var(--text)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {sections.map(s => (
        <div key={s.title}>
          <div className="text-xs" style={{ fontWeight: 700, color: s.color, marginBottom: '0.25rem' }}>{s.title.toUpperCase()}</div>
          {s.items && s.items.length > 0
            ? <ul style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.items.map((item, i) => <li key={i} style={{ marginBottom: '0.15rem' }}>{item}</li>)}</ul>
            : <p className="text-xs muted">Sin identificar</p>}
        </div>
      ))}
    </div>
  );
}

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
