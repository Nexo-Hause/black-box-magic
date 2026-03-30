'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import type { ComparisonResult, ComparisonMetrics, ReferenceType } from '@/types/comparison';

/* ── Constants ──────────────────────────────────────────────── */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const REFERENCE_OPTIONS: { value: ReferenceType; label: string }[] = [
  { value: 'planogram', label: 'Planograma de productos' },
  { value: 'brand_manual', label: 'Manual de marca' },
  { value: 'checklist', label: 'Checklist normativo' },
  { value: 'blueprint', label: 'Plano o especificaci\u00f3n' },
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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-900/30 border-green-800';
  if (score >= 60) return 'bg-yellow-900/30 border-yellow-800';
  return 'bg-red-900/30 border-red-800';
}

/* ── Toast ──────────────────────────────────────────────────── */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-gray-200 px-5 py-3 rounded-lg shadow-xl text-sm font-medium">
      {message}
    </div>
  );
}

/* ── Upload Zone ────────────────────────────────────────────── */

function UploadZone({
  label,
  hint,
  slot,
  onSelect,
  onClear,
}: {
  label: string;
  hint: string;
  slot: ImageSlot;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!ACCEPTED_TYPES.includes(f.type)) return;
      if (f.size > MAX_SIZE) return;
      onSelect(f);
    },
    [onSelect],
  );

  if (slot.previewUrl) {
    return (
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group">
        <img
          src={slot.previewUrl}
          alt={slot.file?.name || label}
          className="w-full h-56 md:h-64 object-contain bg-gray-950"
        />
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-300 truncate">{slot.file?.name}</p>
            <p className="text-xs text-gray-500">{slot.file ? formatBytes(slot.file.size) : ''}</p>
          </div>
          <button
            onClick={onClear}
            className="ml-3 shrink-0 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Cambiar
          </button>
        </div>
        {/* Invisible click to replace */}
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={`Reemplazar ${label}`}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-900 border-2 border-dashed rounded-xl cursor-pointer transition-colors h-56 md:h-64 flex flex-col items-center justify-center gap-2 ${
        dragActive ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="text-3xl text-gray-600">{label === 'Referencia' ? '\uD83D\uDCCB' : '\uD83D\uDCF7'}</div>
      <p className="text-sm font-semibold text-gray-300">{label}</p>
      <p className="text-xs text-gray-500 text-center px-4">{hint}</p>
      <p className="text-xs text-gray-600 mt-1">JPG, PNG, WebP &mdash; m\u00e1x 5 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

/* ── Accordion Section ──────────────────────────────────────── */

function Accordion({ title, count, children, defaultOpen = false }: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/50 hover:bg-gray-900 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{count}</span>
          <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>&#9660;</span>
        </span>
      </button>
      {open && <div className="px-4 py-3 bg-gray-950/50 space-y-1.5">{children}</div>}
    </div>
  );
}

/* ── Gate Screen (lightweight) ──────────────────────────────── */

function GateScreen({ onSubmit, error, loading }: {
  onSubmit: (email: string) => Promise<void> | void;
  error: string | null;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-lg font-bold text-white mb-1">Black Box Magic</h1>
        <p className="text-sm text-gray-400 mb-6">Comparaci\u00f3n de referencias</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) onSubmit(email.trim());
          }}
        >
          <input
            type="email"
            required
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Verificando...' : 'Continuar'}
          </button>
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        </form>
      </div>
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

  /* Token bypass: ?token= in URL skips auth */
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

  /* File selection handlers */
  const selectFile = useCallback((slot: 'reference' | 'field', file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (slot === 'reference') {
        setReference((prev) => {
          if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return { file, previewUrl, dataUrl };
        });
      } else {
        setField((prev) => {
          if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return { file, previewUrl, dataUrl };
        });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const clearSlot = useCallback((slot: 'reference' | 'field') => {
    if (slot === 'reference') {
      setReference((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return emptySlot;
      });
    } else {
      setField((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return emptySlot;
      });
    }
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
      `COMPARACI\u00d3N DE REFERENCIA \u2014 Black Box Magic`,
      `${'='.repeat(45)}`,
      ``,
      `Cumplimiento general: ${result.complianceScore}%`,
      ``,
      `M\u00e9tricas:`,
      `  Surtido:   ${m.assortment}% (${m.totalFound}/${m.totalExpected} encontrados)`,
      `  Posici\u00f3n:  ${m.positioning}% (${m.totalCorrectPosition}/${m.totalFound} correctos)`,
      `  Precios:   ${m.pricing}% (${m.totalPriceMatch}/${m.totalPriceVisible} coinciden)`,
      `  Huecos:    ${m.gaps} posiciones vac\u00edas`,
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
    setToast(`${feature} \u2014 Pr\u00f3ximamente`);
  }, []);

  /* ── Auth Gate ──────────────────────────────────────────── */

  if (!hasToken && gate.loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasToken && !gate.email) {
    return <GateScreen onSubmit={gate.submitEmail} error={gate.error} loading={gate.loading} />;
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4 md:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-black tracking-widest text-white no-underline hover:text-blue-400 transition-colors"
          >
            BLACK BOX MAGIC
          </Link>
          <div className="flex items-center gap-3">
            {gate.email && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <span>{gate.email}</span>
                <button onClick={gate.clearSession} className="text-gray-600 hover:text-gray-400 transition-colors">
                  salir
                </button>
              </div>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-400 border border-blue-800">
              COMPARAR
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Comparaci\u00f3n de referencia</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sube una referencia y una foto de campo para evaluar el cumplimiento
          </p>
        </div>

        {/* Upload grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reference */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Referencia
            </label>
            <UploadZone
              label="Referencia"
              hint="Planograma, manual de marca, checklist o plano"
              slot={reference}
              onSelect={(f) => selectFile('reference', f)}
              onClear={() => clearSlot('reference')}
            />
            {/* Reference type selector */}
            <select
              value={refType}
              onChange={(e) => setRefType(e.target.value as ReferenceType)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              {REFERENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Field photo */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Foto de campo
            </label>
            <UploadZone
              label="Foto de campo"
              hint="Foto real del anaquel, exhibici\u00f3n o punto de venta"
              slot={field}
              onSelect={(f) => selectFile('field', f)}
              onClear={() => clearSlot('field')}
            />
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={runComparison}
            disabled={!bothReady || pageState === 'analyzing'}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
              bothReady && pageState !== 'analyzing'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {pageState === 'analyzing' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analizando...
              </span>
            ) : (
              'COMPARAR'
            )}
          </button>
          {(pageState !== 'idle') && (
            <button
              onClick={resetAll}
              disabled={pageState === 'analyzing'}
              className="px-6 py-3.5 rounded-xl text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 transition-colors disabled:opacity-50"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Error */}
        {pageState === 'error' && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl px-5 py-4 flex items-start gap-3">
            <span className="text-red-400 text-lg shrink-0 mt-0.5">&#9888;</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-400">Error en la comparaci\u00f3n</p>
              <p className="text-xs text-red-400/80 mt-1">{errorMsg}</p>
              <button
                onClick={runComparison}
                className="mt-3 text-xs font-medium text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {pageState === 'done' && result && (
          <div className="space-y-5">
            {/* Compliance score hero */}
            <div className={`border rounded-xl px-6 py-8 text-center ${scoreBg(result.complianceScore)}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Cumplimiento general
              </p>
              <p className={`text-6xl md:text-7xl font-black tabular-nums ${scoreColor(result.complianceScore)}`}>
                {result.complianceScore}
                <span className="text-3xl md:text-4xl">%</span>
              </p>
              {result.photoQuality === 'poor' && (
                <p className="text-xs text-yellow-400 mt-3">
                  Calidad de foto baja &mdash; los resultados pueden ser imprecisos
                </p>
              )}
              {result.coverage === 'partial' && (
                <p className="text-xs text-yellow-400 mt-1">
                  Cobertura parcial &mdash; no toda la referencia es visible en la foto
                </p>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Surtido"
                value={result.metrics.assortment}
                detail={`${result.metrics.totalFound}/${result.metrics.totalExpected} encontrados`}
              />
              <MetricCard
                label="Posici\u00f3n"
                value={result.metrics.positioning}
                detail={`${result.metrics.totalCorrectPosition}/${result.metrics.totalFound} correctos`}
              />
              <MetricCard
                label="Precios"
                value={result.metrics.pricing}
                detail={`${result.metrics.totalPriceMatch}/${result.metrics.totalPriceVisible} coinciden`}
              />
              <MetricCard
                label="Huecos"
                value={result.metrics.gaps}
                isCount
                detail="posiciones vac\u00edas"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resumen</p>
              <p className="text-sm text-gray-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Detail accordions */}
            <div className="space-y-2">
              <Accordion title="Productos encontrados" count={result.matches.length} defaultOpen>
                {result.matches.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 mt-0.5 ${item.correctPosition ? 'text-green-400' : 'text-yellow-400'}`}>
                      {item.correctPosition ? '\u2713' : '\u25CB'}
                    </span>
                    <div className="min-w-0">
                      <span className="text-gray-300">{item.name}</span>
                      {item.observation && (
                        <span className="text-gray-500 text-xs ml-2">&mdash; {item.observation}</span>
                      )}
                      {!item.correctPosition && (
                        <span className="text-yellow-500 text-xs ml-2">(posici\u00f3n incorrecta)</span>
                      )}
                    </div>
                  </div>
                ))}
              </Accordion>

              <Accordion title="Productos faltantes" count={result.missing.length}>
                {result.missing.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 shrink-0 mt-0.5">\u2717</span>
                    <div className="min-w-0">
                      <span className="text-gray-300">{item.name}</span>
                      {item.expectedPosition && (
                        <span className="text-gray-500 text-xs ml-2">&mdash; esperado en {item.expectedPosition}</span>
                      )}
                      {item.reason && (
                        <span className="text-gray-600 text-xs ml-2">({item.reason})</span>
                      )}
                    </div>
                  </div>
                ))}
              </Accordion>

              <Accordion title="Discrepancias de precio" count={result.priceDiscrepancies.length}>
                {result.priceDiscrepancies.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-400 shrink-0 mt-0.5">$</span>
                    <div className="min-w-0">
                      <span className="text-gray-300">{item.name}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        esperado ${item.expectedPrice.toFixed(2)} &rarr; visto ${item.observedPrice.toFixed(2)}
                      </span>
                      <span className={`text-xs ml-2 ${item.difference > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        ({item.difference > 0 ? '+' : ''}{item.difference.toFixed(2)})
                      </span>
                    </div>
                  </div>
                ))}
              </Accordion>

              <Accordion title="Productos inesperados" count={result.unexpected.length}>
                {result.unexpected.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-400 shrink-0 mt-0.5">?</span>
                    <div className="min-w-0">
                      <span className="text-gray-300">{item.name}</span>
                      {item.position && (
                        <span className="text-gray-500 text-xs ml-2">&mdash; en {item.position}</span>
                      )}
                      {item.observation && (
                        <span className="text-gray-600 text-xs ml-2">({item.observation})</span>
                      )}
                    </div>
                  </div>
                ))}
              </Accordion>
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
              <ExportButton label="Copiar" icon="\uD83D\uDCCB" onClick={copyToClipboard} />
              <ExportButton label="PDF" icon="\uD83D\uDCC4" onClick={() => showComingSoon('Exportar PDF')} />
              <ExportButton label="Excel" icon="\uD83D\uDCCA" onClick={() => showComingSoon('Exportar Excel')} />
              <ExportButton label="WhatsApp" icon="\uD83D\uDCF1" onClick={() => showComingSoon('Compartir por WhatsApp')} />
            </div>

            {/* New comparison */}
            <div className="text-center pt-2">
              <button
                onClick={resetAll}
                className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
              >
                Nueva comparaci\u00f3n
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  detail,
  isCount = false,
}: {
  label: string;
  value: number;
  detail: string;
  isCount?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-center">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black tabular-nums ${isCount ? (value > 0 ? 'text-red-400' : 'text-green-400') : scoreColor(value)}`}>
        {value}{!isCount && <span className="text-lg">%</span>}
      </p>
      <p className="text-xs text-gray-600 mt-1">{detail}</p>
    </div>
  );
}

function ExportButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-300 hover:border-gray-700 hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
