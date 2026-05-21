'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import { useDashboard } from '@/hooks/useDashboard';
import { GateScreen } from '../demo/gate';
import { IncidenceRecord, IncidenceFilters } from '@/types/incidence';

// Category translations
const CATEGORY_LABELS: Record<string, string> = {
  missing_product: 'Producto Faltante',
  wrong_position: 'Posición Incorrecta',
  wrong_price: 'Precio Incorrecto',
  empty_shelf: 'Anaquel Vacío',
  unauthorized_product: 'Producto No Autorizado',
  damaged_product: 'Producto Dañado',
  wrong_facing: 'Frentes Incorrectos',
  other: 'Otro',
};

// Date formatter in America/Mexico_City timezone
function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return dateStr;
  }
}

export default function DashboardPage() {
  const gate = useEmailGate();
  const dashboard = useDashboard();
  
  // Local state to track planograms of the selected client (for Empty State #1 and #2)
  const [planograms, setPlanograms] = useState<any[]>([]);
  const [planogramsLoading, setPlanogramsLoading] = useState<boolean>(true);

  // Fetch planograms whenever client changes
  useEffect(() => {
    if (!gate.email || !dashboard.selectedClientId) return;

    let active = true;
    const fetchPlanograms = async () => {
      setPlanogramsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('clientId', dashboard.selectedClientId);
        const res = await fetch(`/api/planogram/list?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.planograms) {
            setPlanograms(data.planograms);
          }
        }
      } catch (err) {
        console.error('Error fetching planograms for empty states:', err);
      } finally {
        if (active) setPlanogramsLoading(false);
      }
    };

    fetchPlanograms();
    return () => {
      active = false;
    };
  }, [gate.email, dashboard.selectedClientId]);

  // Derived metrics from rows
  const metrics = {
    totalIncidences: dashboard.rows.reduce((sum, r) => sum + (r.incidence_count || 0), 0),
    criticalCount: dashboard.rows.reduce((sum, r) => sum + (r.severity_critical || 0), 0),
    highCount: dashboard.rows.reduce((sum, r) => sum + (r.severity_high || 0), 0),
    pendingCount: dashboard.rows.filter(r => r.status === 'pending').length,
  };

  // Check if any filter is active
  const hasActiveFilters = Object.entries(dashboard.filters).some(([key, val]) => {
    if (key === 'sort') return false;
    return val !== undefined && val !== '';
  });

  // Action to reset filters
  const handleResetFilters = () => {
    dashboard.setFilters({
      dateFrom: '',
      dateTo: '',
      promoter: '',
      store: '',
      minSeverity: undefined,
      status: '',
    });
  };

  // Build the export file path with current filters
  const getExportUrl = () => {
    const queryParams = new URLSearchParams();
    if (dashboard.filters.dateFrom) queryParams.set('dateFrom', dashboard.filters.dateFrom);
    if (dashboard.filters.dateTo) queryParams.set('dateTo', dashboard.filters.dateTo);
    if (dashboard.filters.promoter) queryParams.set('promoter', dashboard.filters.promoter);
    if (dashboard.filters.store) queryParams.set('store', dashboard.filters.store);
    if (dashboard.filters.minSeverity) queryParams.set('minSeverity', dashboard.filters.minSeverity);
    if (dashboard.filters.status) queryParams.set('status', dashboard.filters.status);
    if (dashboard.filters.sort) queryParams.set('sort', dashboard.filters.sort);
    if (dashboard.selectedClientId) {
      queryParams.set('clientId', dashboard.selectedClientId);
    }
    return `/api/planogram/export?${queryParams.toString()}`;
  };

  // Gate Loading Screen
  if (gate.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Gate Login Screen
  if (!gate.email) {
    return <GateScreen onSubmit={gate.submitEmail} error={gate.error} loading={gate.loading} />;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ fontSize: '0.875rem', fontWeight: 900, textDecoration: 'none', color: 'var(--text)', letterSpacing: '0.05em' }}>
            BLACK BOX MAGIC
          </Link>
          <span className="badge badge--neutral">DASHBOARD</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Client Selector (only shown if multi-tenant / multiple clients) */}
          {dashboard.clients.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="client-selector" className="text-xs muted" style={{ fontWeight: 700 }}>CLIENTE:</label>
              <select
                id="client-selector"
                value={dashboard.selectedClientId}
                onChange={e => dashboard.setSelectedClientId(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', border: '2px solid var(--border)', fontFamily: 'var(--font)', fontWeight: 700 }}
              >
                <option value="">Seleccionar cliente</option>
                {dashboard.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation links */}
          <Link href="/dashboard/planograms" className="btn btn--secondary btn--small" style={{ fontSize: '0.75rem' }}>
            📁 PLANOGRAMAS
          </Link>

          {/* User authentication info */}
          <div className="user-bar">
            <span className="user-bar__email">{gate.email}</span>
            <button className="user-bar__logout" onClick={gate.clearSession}>not you?</button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      {dashboard.error && (
        <div className="card" style={{ borderColor: 'var(--accent-red)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--accent-red)' }}>Error</p>
            <p className="text-sm">{dashboard.error}</p>
          </div>
          <button className="btn btn--secondary btn--small" onClick={dashboard.clearError}>✕</button>
        </div>
      )}

      {/* 1. Empty State #1: No planograms uploaded yet */}
      {!planogramsLoading && planograms.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>SIN PLANOGRAMAS CARGADOS</h2>
          <p className="muted text-sm" style={{ maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
            Para poder empezar a procesar incidencias y ver análisis visuales, primero debes subir un planograma base para tu cliente <strong>{dashboard.selectedClientName || 'asignado'}</strong>.
          </p>
          <Link href="/dashboard/planograms" className="btn btn--primary">
            Subir Planograma Ahora
          </Link>
        </div>
      ) : (
        <>
          {/* Dashboard filters and search criteria */}
          <section className="card card--subtle" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>DESDE:</label>
                <input
                  type="date"
                  value={dashboard.filters.dateFrom || ''}
                  onChange={e => dashboard.setFilters({ dateFrom: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                />
              </div>

              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>HASTA:</label>
                <input
                  type="date"
                  value={dashboard.filters.dateTo || ''}
                  onChange={e => dashboard.setFilters({ dateTo: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                />
              </div>

              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>PROMOTOR:</label>
                <input
                  type="text"
                  placeholder="Buscar promotor..."
                  value={dashboard.filters.promoter || ''}
                  onChange={e => dashboard.setFilters({ promoter: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                />
              </div>

              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>TIENDA:</label>
                <input
                  type="text"
                  placeholder="Buscar tienda..."
                  value={dashboard.filters.store || ''}
                  onChange={e => dashboard.setFilters({ store: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                />
              </div>

              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>SEVERIDAD MÍNIMA:</label>
                <select
                  value={dashboard.filters.minSeverity || ''}
                  onChange={e => dashboard.setFilters({ minSeverity: e.target.value ? e.target.value as any : undefined })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                >
                  <option value="">Todas</option>
                  <option value="critical">Crítica</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </div>

              <div>
                <label className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>ESTADO:</label>
                <select
                  value={dashboard.filters.status || ''}
                  onChange={e => dashboard.setFilters({ status: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', border: '2px solid var(--border-light)', fontFamily: 'var(--font)' }}
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="processing">Procesando</option>
                  <option value="completed">Completado</option>
                  <option value="failed">Fallido</option>
                </select>
              </div>
            </div>

            {/* Filter control actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                {hasActiveFilters && (
                  <button className="btn btn--secondary btn--small" onClick={handleResetFilters}>
                    ✕ RESTABLECER FILTROS
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={getExportUrl()}
                  className="btn btn--secondary btn--small"
                  style={{ color: 'var(--text)', border: '2px solid var(--border)', fontWeight: 700 }}
                  download
                >
                  📊 EXPORTAR EXCEL
                </a>
              </div>
            </div>
          </section>

          {/* Cards: Summary metrics (clamped to the visible batch) */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
              <span className="text-xs muted" style={{ fontWeight: 700 }}>INCIDENCIAS TOTALES</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>{metrics.totalIncidences}</span>
              <span className="text-xs muted" style={{ marginTop: 'auto' }}>En lote visible</span>
            </div>
            
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', borderLeftColor: 'var(--accent-red)', borderLeftWidth: '5px' }}>
              <span className="text-xs" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>SEVERIDAD CRÍTICA</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem', color: 'var(--accent-red)' }}>{metrics.criticalCount}</span>
              <span className="text-xs muted" style={{ marginTop: 'auto' }}>Requieren atención inmediata</span>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', borderLeftColor: 'var(--accent-yellow)', borderLeftWidth: '5px' }}>
              <span className="text-xs" style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>SEVERIDAD ALTA</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem', color: 'var(--accent-yellow)' }}>{metrics.highCount}</span>
              <span className="text-xs muted" style={{ marginTop: 'auto' }}>Problemas prioritarios</span>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
              <span className="text-xs muted" style={{ fontWeight: 700 }}>PENDIENTES</span>
              <span style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>{metrics.pendingCount}</span>
              <span className="text-xs muted" style={{ marginTop: 'auto' }}>En espera de procesamiento</span>
            </div>
          </section>

          {/* Results section */}
          {dashboard.loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontWeight: 700 }}>Cargando incidencias...</p>
            </div>
          ) : dashboard.rows.length === 0 ? (
            <>
              {/* Empty state #3: No results found for active filters */}
              {hasActiveFilters ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.5rem' }}>SIN RESULTADOS</h2>
                  <p className="muted text-sm" style={{ maxWidth: '400px', margin: '0 auto 1rem' }}>
                    No se encontraron incidencias que coincidan con los filtros aplicados actualmente.
                  </p>
                  <button className="btn btn--secondary btn--small" onClick={handleResetFilters}>
                    Restablecer Filtros
                  </button>
                </div>
              ) : (
                /* Empty state #2: No incidences captured or processed yet */
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.5rem' }}>SIN INCIDENCIAS REGISTRADAS</h2>
                  <p className="muted text-sm" style={{ maxWidth: '450px', margin: '0 auto' }}>
                    El sistema está listo y esperando a que los promotores registren capturas visuales en campo vía Ubiqo.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Results table */
            <div className="card" style={{ padding: 0, overflowX: 'auto', borderBottom: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    {dashboard.clients.length > 1 && <th>Cliente</th>}
                    <th>Promotor</th>
                    <th>Tienda</th>
                    <th>Incidencias</th>
                    <th>Estado</th>
                    <th>Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.rows.map(row => (
                    <tr key={row.id} onClick={() => dashboard.openDetail(row.id)}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatDate(row.photo_captured_at || row.created_at)}</td>
                      {dashboard.clients.length > 1 && <td style={{ fontWeight: 700 }}>{dashboard.clients.find(c => c.id === row.client_id)?.name || '—'}</td>}
                      <td style={{ whiteSpace: 'nowrap' }}>{row.promoter_name || '—'}</td>
                      <td>{row.store_name || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {row.severity_critical > 0 && <span className="badge badge--red" style={{ fontSize: '0.65rem' }}>{row.severity_critical} CRÍTICA</span>}
                          {row.severity_high > 0 && <span className="badge badge--red" style={{ fontSize: '0.65rem' }}>{row.severity_high} ALTA</span>}
                          {row.severity_medium > 0 && <span className="badge badge--yellow" style={{ fontSize: '0.65rem' }}>{row.severity_medium} MED</span>}
                          {row.severity_low > 0 && <span className="badge badge--green" style={{ fontSize: '0.65rem' }}>{row.severity_low} BAJA</span>}
                          {row.incidence_count === 0 && <span className="badge badge--green" style={{ fontSize: '0.65rem' }}>OK</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          row.status === 'completed' ? 'badge--green' :
                          row.status === 'processing' ? 'badge--yellow' :
                          row.status === 'failed' ? 'badge--red' : 'badge--neutral'
                        }`}>
                          {row.status === 'completed' ? 'Completado' :
                           row.status === 'processing' ? 'Procesando' :
                           row.status === 'failed' ? 'Fallido' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.summary || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table pagination navigation controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '2px solid var(--border)' }}>
                <span className="text-xs muted">
                  Mostrando del {((dashboard.page - 1) * dashboard.limit) + 1} al {Math.min(dashboard.page * dashboard.limit, dashboard.total)} de {dashboard.total} comparaciones
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn--secondary btn--small"
                    onClick={() => dashboard.setPage(dashboard.page - 1)}
                    disabled={dashboard.page === 1 || dashboard.loading}
                  >
                    ◀ ANTERIOR
                  </button>
                  <span className="text-xs" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 700 }}>
                    PÁGINA {dashboard.page}
                  </span>
                  <button
                    className="btn btn--secondary btn--small"
                    onClick={() => dashboard.setPage(dashboard.page + 1)}
                    disabled={dashboard.page * dashboard.limit >= dashboard.total || dashboard.loading}
                  >
                    SIGUIENTE ▶
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Detail Overlay panel */}
      {dashboard.detail && (
        <div className="modal-overlay" onClick={dashboard.closeDetail}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900 }}>DETALLE DE INCIDENCIA</h2>
              <button className="btn btn--secondary btn--small" onClick={dashboard.closeDetail}>✕</button>
            </div>
            
            <div className="modal-body">
              {/* Basic metadata list card */}
              <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>Promotor: <strong>{dashboard.detail.promoter_name || '—'}</strong></div>
                  <div>Tienda: <strong>{dashboard.detail.store_name || '—'}</strong></div>
                  <div>Fecha de Captura: <strong>{formatDate(dashboard.detail.photo_captured_at || dashboard.detail.created_at)}</strong></div>
                  <div>Estado: <span className={`badge ${
                    dashboard.detail.status === 'completed' ? 'badge--green' :
                    dashboard.detail.status === 'processing' ? 'badge--yellow' :
                    dashboard.detail.status === 'failed' ? 'badge--red' : 'badge--neutral'
                  }`}>{dashboard.detail.status}</span></div>
                  <div>Calidad Foto: <strong style={{ textTransform: 'uppercase' }}>{dashboard.detail.photo_quality || '—'}</strong></div>
                  <div>Cobertura: <strong style={{ textTransform: 'uppercase' }}>{dashboard.detail.coverage || '—'}</strong></div>
                </div>

                {dashboard.detail.summary && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                    <h3 className="text-xs muted" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>RESUMEN:</h3>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{dashboard.detail.summary}</p>
                  </div>
                )}
              </div>

              {/* Side-by-side comparison images grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '0.75rem' }}>
                  <h3 className="text-xs muted" style={{ fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Foto de Campo</h3>
                  <div style={{ width: '100%', height: '300px', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    {dashboard.detail.fieldPhotoUrls && dashboard.detail.fieldPhotoUrls.length > 0 ? (
                      <img
                        src={dashboard.detail.fieldPhotoUrls[0]}
                        alt="Foto de campo tomada por promotor"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span className="text-xs muted">Sin foto disponible</span>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: '0.75rem' }}>
                  <h3 className="text-xs muted" style={{ fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Planograma de Referencia</h3>
                  <div style={{ width: '100%', height: '300px', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                    {dashboard.detail.planogramUrl ? (
                      <img
                        src={dashboard.detail.planogramUrl}
                        alt="Planograma base asignado"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span className="text-xs muted">Sin planograma asignado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed incidences list table */}
              <div className="card" style={{ padding: '1rem' }}>
                <h3 className="text-xs muted" style={{ fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Incidencias Detectadas</h3>
                {dashboard.detail.incidences && dashboard.detail.incidences.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Categoría</th>
                          <th>Severidad</th>
                          <th>Producto</th>
                          <th>Ubicación</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.detail.incidences.map((inc: any, index: number) => (
                          <tr key={index}>
                            <td style={{ fontWeight: 700 }}>{CATEGORY_LABELS[inc.category] || inc.category}</td>
                            <td>
                              <span className={`badge ${
                                inc.severity === 'critical' ? 'badge--red' :
                                inc.severity === 'high' ? 'badge--red' :
                                inc.severity === 'medium' ? 'badge--yellow' : 'badge--green'
                              }`}>{inc.severity}</span>
                            </td>
                            <td>{inc.product || '—'}</td>
                            <td>{inc.location || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>{inc.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No se detectaron problemas en esta comparación. ¡Anaquel en cumplimiento!</p>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn--primary btn--small" onClick={dashboard.closeDetail}>
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
