'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import { useDashboard } from '@/hooks/useDashboard';
import { GateScreen } from '../../demo/gate';

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

export default function PlanogramsPage() {
  const gate = useEmailGate();
  const dashboard = useDashboard(gate.email);

  // Local state for planograms
  const [planograms, setPlanograms] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  // Local state for upload form
  const [uploadName, setUploadName] = useState<string>('');
  const [uploadSection, setUploadSection] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for assignments input and errors
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});
  const [assignSuccess, setAssignSuccess] = useState<Record<string, boolean>>({});
  const [assignLoading, setAssignLoading] = useState<Record<string, boolean>>({});

  // Fetch planograms
  const fetchPlanograms = useCallback(async () => {
    if (!dashboard.selectedClientId) return;
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('clientId', dashboard.selectedClientId);
      const res = await fetch(`/api/planogram/list?${queryParams.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener planogramas.');
      setPlanograms(data.planograms || []);
      
      // Initialize form inputs with existing form_ids
      const inputs: Record<string, string> = {};
      (data.planograms || []).forEach((p: any) => {
        if (p.form_id) {
          inputs[p.id] = p.form_id;
        }
      });
      setFormInputs(inputs);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la API.');
    } finally {
      setLoading(false);
    }
  }, [dashboard.selectedClientId]);

  // Load planograms when selectedClientId changes
  useEffect(() => {
    if (gate.email && dashboard.selectedClientId) {
      fetchPlanograms();
    }
  }, [gate.email, dashboard.selectedClientId, fetchPlanograms]);

  // Handle Drag & Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setUploadFile(file);
        if (!uploadName) {
          // prefill name with sanitized file name
          setUploadName(file.name.replace(/\.[^/.]+$/, ""));
        }
        setUploadError('');
      } else {
        setUploadError('Solo se permiten archivos de imagen (JPEG, PNG, WebP).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      }
      setUploadError('');
    }
  };

  // Upload planogram
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Por favor selecciona una imagen de planograma.');
      return;
    }
    if (!uploadName.trim()) {
      setUploadError('Por favor escribe un nombre para el planograma.');
      return;
    }

    const currentClient = dashboard.clients.find(c => c.id === dashboard.selectedClientId);
    const clientKey = currentClient?.client_key;

    if (!clientKey) {
      setUploadError('No se pudo identificar la clave de tenencia del cliente.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('clientKey', clientKey);
      formData.append('name', uploadName.trim());
      if (uploadSection.trim()) {
        formData.append('section', uploadSection.trim());
      }

      const res = await fetch('/api/planogram/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fallo al subir planograma.');

      setUploadSuccess(true);
      setUploadFile(null);
      setUploadName('');
      setUploadSection('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Reload list
      await fetchPlanograms();
      
      // Auto-hide success message
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err: any) {
      setUploadError(err.message || 'Error al subir el planograma.');
    } finally {
      setUploading(false);
    }
  };

  // Assign Form ID to planogram
  const handleAssignSubmit = async (planogramId: string) => {
    const formId = formInputs[planogramId]?.trim();
    if (!formId) {
      setAssignErrors(prev => ({ ...prev, [planogramId]: 'El ID de formulario es requerido.' }));
      return;
    }

    setAssignLoading(prev => ({ ...prev, [planogramId]: true }));
    setAssignErrors(prev => ({ ...prev, [planogramId]: '' }));
    setAssignSuccess(prev => ({ ...prev, [planogramId]: false }));

    try {
      const res = await fetch('/api/planogram/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planogram_id: planogramId, form_id: formId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al asignar formulario.');

      setAssignSuccess(prev => ({ ...prev, [planogramId]: true }));
      
      // Refresh list to update state globally
      await fetchPlanograms();

      setTimeout(() => {
        setAssignSuccess(prev => ({ ...prev, [planogramId]: false }));
      }, 3000);
    } catch (err: any) {
      setAssignErrors(prev => ({ ...prev, [planogramId]: err.message || 'Error al asignar.' }));
    } finally {
      setAssignLoading(prev => ({ ...prev, [planogramId]: false }));
    }
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
          <Link href="/dashboard" style={{ fontSize: '0.875rem', fontWeight: 900, textDecoration: 'none', color: 'var(--text)', letterSpacing: '0.05em' }}>
            BLACK BOX MAGIC
          </Link>
          <span className="badge badge--neutral">PLANOGRAMAS</span>
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
          <Link href="/dashboard" className="btn btn--secondary btn--small" style={{ fontSize: '0.75rem' }}>
            ◀ DASHBOARD
          </Link>

          {/* User authentication info */}
          <div className="user-bar">
            <span className="user-bar__email">{gate.email}</span>
            <button className="user-bar__logout" onClick={gate.clearSession}>not you?</button>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Upload panel (Left/Top side) */}
        <section className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '1rem', textTransform: 'uppercase' }}>Subir Nuevo Planograma</h2>
          
          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Drag & Drop zone */}
            <div
              className={`drop-zone${dragActive ? ' drop-zone--active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '2rem 1rem', borderStyle: 'dashed' }}
            >
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📷</span>
              {uploadFile ? (
                <div>
                  <strong className="text-sm" style={{ wordBreak: 'break-all' }}>{uploadFile.name}</strong>
                  <span className="text-xs muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                    ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>Arrastra o selecciona la imagen</span>
                  <span className="text-xs muted">JPG, PNG, WebP — máx 5MB</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Inputs */}
            <div>
              <label htmlFor="planogram-name" className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>NOMBRE DEL PLANOGRAMA:</label>
              <input
                id="planogram-name"
                type="text"
                placeholder="Ej. FOTL Caballeros Verano"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', border: '2px solid var(--border)', fontFamily: 'var(--font)' }}
                required
              />
            </div>

            <div>
              <label htmlFor="planogram-section" className="text-xs muted" style={{ display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>SECCIÓN (OPCIONAL):</label>
              <input
                id="planogram-section"
                type="text"
                placeholder="Ej. Pasillo 3 / Caballeros"
                value={uploadSection}
                onChange={e => setUploadSection(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', border: '2px solid var(--border)', fontFamily: 'var(--font)' }}
              />
            </div>

            {/* Upload notifications */}
            {uploadError && <p className="gate-error" style={{ marginTop: 0 }}>{uploadError}</p>}
            {uploadSuccess && (
              <p className="text-xs" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                ¡Planograma subido e insertado con éxito!
              </p>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={uploading || !uploadFile}
              style={{ width: '100%', padding: '0.75rem' }}
            >
              {uploading ? 'SUBIENDO...' : 'SUBIR PLANOGRAMA'}
            </button>
          </form>
        </section>

        {/* Planograms Grid (Right/Bottom side) */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Planogramas Activos ({planograms.length})
          </h2>

          {error && (
            <div className="card" style={{ borderColor: 'var(--accent-red)' }}>
              <p style={{ fontWeight: 700, color: 'var(--accent-red)' }}>Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p className="text-sm">Cargando catálogo...</p>
            </div>
          ) : planograms.length === 0 ? (
            <div className="card card--subtle" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📁</span>
              <p style={{ fontWeight: 700 }}>Sin planogramas registrados</p>
              <p className="muted text-xs mt-1">Usa el formulario de la izquierda para dar de alta el primer planograma.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {planograms.map(p => (
                <div key={p.id} className="card card--subtle" style={{ display: 'flex', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
                  {/* secure signed thumbnail image */}
                  <div style={{ width: '100px', height: '100px', backgroundColor: '#eee', border: '2px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.signedUrl ? (
                      <img src={p.signedUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span className="text-xs muted">Thumbnail</span>
                    )}
                  </div>

                  {/* detail info & assignment form */}
                  <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase' }}>{p.name}</h3>
                        {p.active ? (
                          <span className="badge badge--green" style={{ fontSize: '0.6rem' }}>Activo</span>
                        ) : (
                          <span className="badge badge--neutral" style={{ fontSize: '0.6rem' }}>Inactivo</span>
                        )}
                      </div>
                      <p className="text-xs muted" style={{ marginTop: '0.25rem' }}>
                        Sección: <strong>{p.section || 'General'}</strong>
                      </p>
                      <p className="text-xs muted">
                        Subido: <strong>{formatDate(p.created_at)}</strong>
                      </p>
                    </div>

                    {/* form assignment */}
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <label htmlFor={`form-id-${p.id}`} className="text-xs muted" style={{ fontWeight: 700 }}>UBIQO FORM_ID:</label>
                        {p.form_id && (
                          <span className="badge badge--blue" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem' }}>Asignado</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <input
                          id={`form-id-${p.id}`}
                          type="text"
                          placeholder="ID de Formulario"
                          value={formInputs[p.id] || ''}
                          onChange={e => setFormInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                          disabled={assignLoading[p.id]}
                          style={{ flex: 1, padding: '0.35rem', fontSize: '0.75rem', border: '2px solid var(--border)', fontFamily: 'var(--font)' }}
                        />
                        <button
                          type="button"
                          className="btn btn--primary btn--small"
                          onClick={() => handleAssignSubmit(p.id)}
                          disabled={assignLoading[p.id] || !formInputs[p.id]?.trim()}
                        >
                          {assignLoading[p.id] ? '...' : 'ASIGNAR'}
                        </button>
                      </div>

                      {/* feedback notifications per card */}
                      {assignErrors[p.id] && (
                        <p className="gate-error" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                          {assignErrors[p.id]}
                        </p>
                      )}
                      {assignSuccess[p.id] && (
                        <p className="text-xs" style={{ color: 'var(--accent-green)', fontWeight: 700, marginTop: '0.25rem' }}>
                          ¡Asignado con éxito!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
