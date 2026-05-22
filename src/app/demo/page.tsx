'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useEmailGate } from '@/hooks/useEmailGate';
import { GateScreen } from './gate';
import { ResultView, StatusDot, ImageJob } from '@/components/demo/ResultView';
import type { ComparisonResult } from '@/types/comparison';
import styles from './demo.module.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const PARALLEL_LIMIT = 2;

// Estructura de imágenes de respaldo para el taller
const BACKUP_ASSETS = [
  { url: '/workshop/perfect_soda_shelf.png', name: 'tienda_perfecta_refrescos.png', label: 'Estante Perfecto (Refrescos)' },
  { url: '/workshop/messy_soda_shelf.png', name: 'tienda_desorden_refrescos.png', label: 'Tienda con Desvíos (Refrescos)' },
  { url: '/workshop/messy_apparel_shelf.png', name: 'ropa_desorganizada.png', label: 'Tienda con Desvíos (Ropa)' }
];

// Presets de reglas de negocio para el taller de ventas
const RULE_PRESETS = [
  {
    title: '🥫 Refrescos y Bebidas',
    text: 'Asegura que Coca-Cola Original tenga al menos el 50% de participación en el anaquel (shelf share). Valida que los precios estén visibles y que el estante de sodas esté limpio y ordenado, sin latas abolladas.'
  },
  {
    title: '👕 Ropa y Textil',
    text: 'Valida que todas las prendas estén correctamente colgadas y separadas por color (de oscuro a claro). Reporta perchas vacías o desorganizadas y asegúrate de que no haya ropa en el piso.'
  },
  {
    title: '💊 Farmacias',
    text: 'Detecta la visibilidad de analgésicos de marca líder en la parte media-alta del exhibidor. Asegura que los carteles promocionales de descuento no estén rotos ni tapados por los productos.'
  },
  {
    title: '🍔 Hamburguesas / QSR',
    text: 'Audita la higiene del mostrador y el área de preparación. Asegura que los menús digitales estén encendidos y que la señalización de combo esté alineada con las reglas de marca.'
  }
];

// Función de compresión cliente-side nativa usando HTML5 Canvas
function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto de canvas 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Comprimir como JPEG al 80% de calidad para ahorrar 95% del payload de red
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ base64: compressedBase64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen para compresión'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.readAsDataURL(file);
  });
}

// Extensión del tipo ImageJob para soportar Modo B en el cliente
interface ExtendedImageJob extends ImageJob {
  comparisonResult?: ComparisonResult;
  compressionProgress?: 'pending' | 'compressing' | 'ready' | 'failed';
}

export default function DemoPage() {
  const gate = useEmailGate();
  
  // Estados principales del taller interactivo B2B
  const [mode, setMode] = useState<'direct' | 'comparative'>('direct');
  const [customRules, setCustomRules] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCompacting, setIsCompacting] = useState(false);

  // Dictado por voz (Opción A)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador. Te recomendamos usar Chrome, Edge o Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-MX';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Error en reconocimiento de voz:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        let currentResult = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentResult += event.results[i][0].transcript;
          }
        }
        if (currentResult) {
          setCustomRules(prev => {
            const cleanPrev = prev ? prev.trim() : '';
            const space = cleanPrev ? ' ' : '';
            return cleanPrev + space + currentResult.trim();
          });
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Error al iniciar SpeechRecognition:", err);
      setIsListening(false);
    }
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  const [jobs, setJobs] = useState<ExtendedImageJob[]>([]);
  const [activeId, setActiveId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Ranura para la imagen de referencia en Modo B
  const [referenceSlot, setReferenceSlot] = useState<{
    fileName: string;
    previewUrl: string;
    base64: string;
    mimeType: string;
    status: 'pending' | 'compressing' | 'ready' | 'failed';
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Helper para simular el click de presets y pegado rápido de reglas
  const applyPreset = (text: string) => {
    setCustomRules(text);
  };

  // Función asíncrona para cargar imágenes de respaldo del taller
  const loadBackupImage = async (url: string, fileName: string, isReference: boolean = false) => {
    try {
      setIsCompacting(true);
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });

      if (isReference) {
        setReferenceSlot({
          fileName: file.name,
          previewUrl: url,
          base64: '',
          mimeType: file.type,
          status: 'compressing',
        });
        const { base64, mimeType } = await compressImage(file);
        setReferenceSlot({
          fileName: file.name,
          previewUrl: url,
          base64,
          mimeType,
          status: 'ready',
        });
      } else {
        const id = crypto.randomUUID();
        const previewUrl = url;
        const newJob: ExtendedImageJob = {
          id,
          fileName: file.name,
          previewUrl,
          base64: '',
          mimeType: file.type,
          status: 'pending' as const,
          compressionProgress: 'compressing',
        };

        setJobs(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          setActiveId(id);
          return [...prev, newJob];
        });

        const { base64, mimeType } = await compressImage(file);
        setJobs(prev => prev.map(j => j.id === id ? { ...j, base64, mimeType, compressionProgress: 'ready' } : j));
      }
    } catch (err) {
      console.error('Error al cargar imagen de respaldo:', err);
    } finally {
      setIsCompacting(false);
    }
  };

  const addFiles = useCallback((files: FileList) => {
    const valid = Array.from(files).filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE);
    if (!valid.length) return;

    setJobs(prev => {
      const allowed = valid.slice(0, MAX_IMAGES - prev.length);
      if (!allowed.length) return prev;

      const newJobs: ExtendedImageJob[] = allowed.map(f => ({
        id: crypto.randomUUID(),
        fileName: f.name,
        previewUrl: URL.createObjectURL(f),
        base64: '',
        mimeType: f.type,
        status: 'pending' as const,
        compressionProgress: 'compressing',
      }));

      allowed.forEach(async (file, idx) => {
        try {
          // Compresión de Canvas nativa en background
          const { base64, mimeType } = await compressImage(file);
          setJobs(p => p.map(j => j.id === newJobs[idx].id ? { 
            ...j, 
            base64, 
            mimeType, 
            compressionProgress: 'ready' 
          } : j));
        } catch (err) {
          console.error('Canvas compression failed, falling back to original:', err);
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = reader.result as string;
            setJobs(p => p.map(j => j.id === newJobs[idx].id ? { 
              ...j, 
              base64: b64, 
              compressionProgress: 'ready' 
            } : j));
          };
          reader.readAsDataURL(file);
        }
      });

      setActiveId(newJobs[0].id);
      return [...prev, ...newJobs];
    });
  }, []);

  const addReferenceFile = useCallback((files: FileList) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_SIZE) return;

    setReferenceSlot({
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      base64: '',
      mimeType: file.type,
      status: 'compressing',
    });

    (async () => {
      try {
        const { base64, mimeType } = await compressImage(file);
        setReferenceSlot(prev => prev ? { ...prev, base64, mimeType, status: 'ready' } : null);
      } catch (err) {
        console.error('Reference image compression failed, falling back to original:', err);
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          setReferenceSlot(prev => prev ? { ...prev, base64: b64, status: 'ready' } : null);
        };
        reader.readAsDataURL(file);
      }
    })();
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs(prev => {
      const job = prev.find(j => j.id === id);
      if (job) URL.revokeObjectURL(job.previewUrl);
      const next = prev.filter(j => j.id !== id);
      if (next.length === 0) {
        setActiveId('');
      } else {
        setActiveId(curr => curr === id ? next[0].id : curr);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setJobs(prev => {
      prev.forEach(j => URL.revokeObjectURL(j.previewUrl));
      return [];
    });
    setReferenceSlot(prev => {
      if (prev && !prev.previewUrl.startsWith('/workshop/')) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setActiveId('');
    setIsAnalyzing(false);
  }, []);

  const analyzeOne = useCallback(async (job: ExtendedImageJob) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'analyzing' as const, startedAt: Date.now() } : j));
    try {
      if (mode === 'direct') {
        // MODO A: Auditoría Directa Inteligente con Reglas
        const res = await fetch('/api/demo/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: job.base64, 
            mime_type: job.mimeType, 
            fileName: job.fileName,
            custom_rules: customRules || undefined
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          status: 'done' as const, 
          result: data, 
          logId: data.log_id || undefined, 
          elapsed: Date.now() - (j.startedAt || Date.now()), 
          base64: '' // Limpiar con éxito para liberar memoria
        } : j));
      } else {
        // MODO B: Comparativo contra Punto de Contraste
        if (!referenceSlot?.base64) {
          throw new Error('Debes subir un Punto de Contraste para el Modo Comparativo');
        }

        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceImage: referenceSlot.base64,
            fieldImage: job.base64,
            referenceType: 'planogram',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          status: 'done' as const, 
          comparisonResult: (data.comparison || data.result) as ComparisonResult, 
          logId: data.log_id || undefined, 
          elapsed: Date.now() - (j.startedAt || Date.now()), 
          base64: '' // Limpiar con éxito para liberar memoria
        } : j));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // MITIGACIÓN UX: NO limpiar base64 en caso de error para permitir REINTENTAR correctamente
      setJobs(prev => prev.map(j => j.id === job.id ? { 
        ...j, 
        status: 'error' as const, 
        error: msg, 
        elapsed: Date.now() - (j.startedAt || Date.now()) 
      } : j));
    }
  }, [mode, customRules, referenceSlot]);

  // Ref de jobs para analyzeAll
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const analyzeAll = useCallback(async () => {
    setIsAnalyzing(true);
    const pending = jobsRef.current.filter(j => j.status === 'pending' && j.base64);
    for (let i = 0; i < pending.length; i += PARALLEL_LIMIT) {
      const batch = pending.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(batch.map(analyzeOne));
    }
    setIsAnalyzing(false);
  }, [analyzeOne]);

  useEffect(() => {
    if (!jobs.some(j => j.status === 'analyzing')) return;
    const iv = setInterval(() => {
      setJobs(prev => prev.map(j =>
        j.status === 'analyzing' && j.startedAt ? { ...j, elapsed: Date.now() - j.startedAt } : j
      ));
    }, 1000);
    return () => clearInterval(iv);
  }, [jobs]);

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
  const pendingCount = jobs.filter(j => j.status === 'pending').length;
  const canAnalyze = jobs.some(j => j.status === 'pending' && j.base64) && (mode === 'direct' || !!referenceSlot?.base64);

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Botón flotante para el Asistente del Taller */}
      <button 
        className={`btn ${sidebarOpen ? 'btn--primary' : 'btn--secondary'} ${styles.tallerSidebarToggle}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <span>{sidebarOpen ? '➡️ OCULTAR ASISTENTE' : '⬅️ ASISTENTE DE TALLER'}</span>
      </button>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: '0.875rem', fontWeight: 900, textDecoration: 'none', color: 'var(--text)', letterSpacing: '0.05em' }}>BLACK BOX MAGIC</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="user-bar">
            <span className="user-bar__email">{gate.email}</span>
            <button className="user-bar__logout" onClick={gate.clearSession}>not you?</button>
          </div>
          <span className="badge badge--neutral">TALLER DE VENTA EN VIVO</span>
        </div>
      </header>

      {/* Grid del Taller con Asistente Lateral */}
      <div className={`${styles.tallerContainer} ${sidebarOpen ? styles.tallerContainerWithSidebar : ''}`}>
        
        {/* Workspace Central del Taller */}
        <div className={styles.tallerWorkspace}>
          
          {/* Switch interactivo de Modo A / Modo B */}
          <div className={styles.tallerSwitchContainer}>
            <button 
              className={`${styles.tallerSwitchOption} ${mode === 'direct' ? styles.tallerSwitchOptionActive : ''}`}
              onClick={() => { setMode('direct'); }}
            >
              Modo A: Auditoría Directa (Sin Contraste)
            </button>
            <button 
              className={`${styles.tallerSwitchOption} ${mode === 'comparative' ? styles.tallerSwitchOptionActive : ''}`}
              onClick={() => { setMode('comparative'); }}
            >
              Modo B: Auditoría Comparativa (Con Contraste)
            </button>
          </div>

          {/* Área de Configuración de Reglas Conversacionales en Vivo */}
          <div className={styles.tallerRulesContainer}>
            <div className={styles.tallerRulesLabel}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Reglas y Criterios Conversacionales de Auditoría</span>
                <span className="badge badge--blue" style={{ fontSize: '0.6rem' }}>AI Prompting</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className={`${styles.micButton} ${isListening ? styles.micButtonListening : ''}`}
                title={isListening ? "Detener dictado por voz" : "Dictar reglas por voz"}
              >
                <span>{isListening ? '🛑' : '🎙️'}</span>
                <span>{isListening ? 'Escuchando...' : 'Dictar por Voz'}</span>
              </button>
            </div>
            <textarea
              className={styles.tallerRulesTextarea}
              placeholder="Ej: Asegura que el estante de sodas esté perfectamente limpio, Coca-Cola tenga al menos el 50% de frentes y los precios estén correctos..."
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
            />
          </div>

          {/* Carga de Punto de Contraste (Solo visible en Modo B) */}
          {mode === 'comparative' && (
            <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Punto de Contraste (Planograma o Tienda Ideal)
                </h3>
                {referenceSlot && (
                  <span className={`badge ${referenceSlot.status === 'ready' ? 'badge--green' : 'badge--yellow'}`}>
                    {referenceSlot.status === 'ready' ? 'CONTRASte LISTO' : 'PROCESANDO...'}
                  </span>
                )}
              </div>

              {!referenceSlot ? (
                <div 
                  className="drop-zone"
                  onClick={() => refFileRef.current?.click()}
                  style={{ padding: '2rem', borderStyle: 'dashed' }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Sube la Imagen de Referencia o Estante Ideal</div>
                  <div className="text-xs muted">Formatos JPG, PNG, WebP</div>
                  <input ref={refFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { if (e.target.files) addReferenceFile(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg)', padding: '0.75rem', border: '1px solid var(--border-light)' }}>
                  <img src={referenceSlot.previewUrl} alt="Referencia" style={{ width: 64, height: 64, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referenceSlot.fileName}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {referenceSlot.status === 'compressing' ? 'Redimensionando a 1600px en cliente...' : 'Imagen optimizada para red (~400KB)'}
                    </div>
                  </div>
                  <button 
                    className="btn btn--secondary btn--small" 
                    onClick={() => {
                      if (!referenceSlot.previewUrl.startsWith('/workshop/')) URL.revokeObjectURL(referenceSlot.previewUrl);
                      setReferenceSlot(null);
                    }}
                  >
                    CAMBIAR
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Barra de progreso de procesamiento e indicación de compresión */}
          {isCompacting && (
            <div className={styles.batchProgressContainer} style={{ padding: '0.75rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                <span>ASISTENTE: DESCARGANDO Y OPTIMIZANDO IMAGEN...</span>
              </div>
            </div>
          )}

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
                  {jobs.length === 0 ? 'Selecciona o arrastra imágenes de tienda para evaluar' : `${jobs.length} imagen${jobs.length > 1 ? 'es' : ''} seleccionada${jobs.length > 1 ? 's' : ''}`}
                </div>
                <div className="text-sm muted">JPG, PNG, WebP — se comprimirán automáticamente a 1600px en vivo</div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
              </div>

              {/* Thumbnails */}
              {jobs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {jobs.map(j => (
                    <div key={j.id} style={{ position: 'relative', width: 72, height: 72, border: '2px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={j.previewUrl} alt={j.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: j.compressionProgress === 'ready' ? 'var(--accent-green)' : 'var(--accent-yellow)' }} />
                      <button onClick={e => { e.stopPropagation(); removeJob(j.id); }} style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, background: 'var(--text)', color: 'var(--bg-white)', border: 'none', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons — inline, always visible after thumbnails */}
              {jobs.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button 
                    className="btn btn--primary" 
                    onClick={analyzeAll} 
                    disabled={!canAnalyze} 
                    style={{ flex: 1, padding: '1rem', fontSize: '1rem' }}
                  >
                    {!canAnalyze && mode === 'comparative' && !referenceSlot 
                      ? 'SUBE UN PUNTO DE CONTRASTE' 
                      : `ANALIZAR ${pendingCount} IMAGEN${pendingCount > 1 ? 'ES' : ''}`}
                  </button>
                  <button className="btn btn--secondary" onClick={clearAll} style={{ padding: '1rem', fontSize: '0.8rem' }}>LIMPIAR</button>
                </div>
              )}
            </>
          )}

          {/* Neo-brutalist Batch progress indicator (Mitigación UX de Caja Negra) */}
          {isAnalyzing && !hasResults && (
            <div className={styles.batchProgressContainer}>
              <div className={styles.batchProgressHeader}>
                <span>PROCESANDO LOTE EN VIVO</span>
                <span className="mono">{Math.round((jobs.filter(j => j.status === 'done' || j.status === 'error').length / jobs.length) * 100)}%</span>
              </div>
              <div className={styles.batchProgressTrack}>
                <div 
                  className={styles.batchProgressBar} 
                  style={{ width: `${(jobs.filter(j => j.status === 'done' || j.status === 'error').length / jobs.length) * 100}%` }}
                />
              </div>
              <div className={styles.imageGridProgress}>
                {jobs.map(j => (
                  <div key={j.id} className={`${styles.imageProgressItem} ${j.status === 'analyzing' ? styles.imageProgressItemActive : ''}`}>
                    <img src={j.previewUrl} alt="" className={styles.imageProgressThumb} />
                    <div className={styles.imageProgressInfo}>
                      <div className={styles.imageProgressName}>{j.fileName}</div>
                      <div className={styles.imageProgressStatus}>
                        {j.status === 'pending' && 'PENDIENTE'}
                        {j.status === 'analyzing' && `ANALIZANDO... (${Math.round((j.elapsed || 0) / 1000)}s)`}
                        {j.status === 'done' && 'COMPLETO ✓'}
                        {j.status === 'error' && 'FALLIDO ✗'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Area */}
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

              {/* Active job result rendering */}
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
                      <p style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.5rem' }}>Análisis Fallido</p>
                      <p className="text-sm">{activeJob.error}</p>
                      <button 
                        className="btn btn--secondary btn--small" 
                        style={{ marginTop: '1rem' }} 
                        onClick={() => {
                          setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, status: 'pending' as const, error: undefined } : j));
                        }}
                      >
                        REINTENTAR
                      </button>
                    </div>
                  )}
                  
                  {activeJob.status === 'done' && (
                    <>
                      {/* Modo A: Mostrar el visor modular de auditoría directa */}
                      {activeJob.result && !activeJob.comparisonResult && (
                        <ResultView 
                          job={activeJob} 
                          allDoneResults={jobs.filter(j => j.status === 'done' && j.result).map(j => j.result!)} 
                        />
                      )}
                      
                      {/* Modo B: Mostrar visor interactivo side-by-side de Punto de Contraste */}
                      {activeJob.comparisonResult && (
                        <ComparativeResultView job={activeJob} result={activeJob.comparisonResult} />
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Sidebar del Asistente de Presentación (B2B Live Sales Workshop Tools) */}
        {sidebarOpen && (
          <aside className={styles.tallerSidebar}>
            <div className={styles.sidebarTitle}>
              <span>⚙️ Asistente de Ventas</span>
            </div>
            
            <p className="text-xs muted" style={{ lineHeight: 1.5 }}>
              Usa estos accesos rápidos durante la demostración en vivo con el prospecto.
            </p>

            {/* Presets de Reglas */}
            <div className={styles.presetGroup}>
              <span className={styles.presetTitle}>Presets de Reglas (Copiar)</span>
              {RULE_PRESETS.map((p, i) => (
                <button 
                  key={i} 
                  className={styles.presetBtn}
                  onClick={() => applyPreset(p.text)}
                >
                  <strong style={{ display: 'block', marginBottom: 2 }}>{p.title}</strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Imágenes de Respaldo Integradas */}
            <div className={styles.presetGroup}>
              <span className={styles.presetTitle}>Fotos de Demostración</span>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Úsalas si el cliente no trae fotos propias para auditar.
              </p>
              
              <div className={styles.backupImagesGrid}>
                {BACKUP_ASSETS.map((asset, i) => (
                  <div 
                    key={i} 
                    className={styles.backupCard}
                    onClick={() => {
                      if (mode === 'comparative' && i === 0) {
                        // Cargar estante perfecto como punto de contraste
                        loadBackupImage(asset.url, asset.name, true);
                      } else {
                        // Cargar como imagen a auditar
                        loadBackupImage(asset.url, asset.name, false);
                      }
                    }}
                    title={`Click para cargar como ${mode === 'comparative' && i === 0 ? 'Punto de Contraste' : 'Foto de Tienda'}`}
                  >
                    <img src={asset.url} alt="" className={styles.backupImg} />
                    <div className={styles.backupLabel}>
                      {mode === 'comparative' && i === 0 ? 'REF 📋' : 'FOTO 📷'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}

// ─── Visor de Resultados del Modo B (Comparación Side-by-Side) ───

function ComparativeResultView({ job, result }: { job: ExtendedImageJob; result: ComparisonResult }) {
  const [openSection, setOpenSection] = useState<string | null>('matches');

  const toggleSection = (sec: string) => {
    setOpenSection(openSection === sec ? null : sec);
  };

  const scoreColor = result.complianceScore >= 80 ? 'var(--accent-green)' : result.complianceScore >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const scoreBadge = result.complianceScore >= 80 ? 'badge--green' : result.complianceScore >= 60 ? 'badge--yellow' : 'badge--red';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Visualización de Comparación en Dos Columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        
        {/* Imagen de Referencia */}
        <div className="card" style={{ padding: '0.75rem', background: '#fafafa' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            📋 Referencia (Punto de Contraste)
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#eee', border: '1px solid var(--border-light)' }}>
            <img src={BACKUP_ASSETS[0].url} alt="Referencia" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

        {/* Imagen Evaluada */}
        <div className="card" style={{ padding: '0.75rem', background: '#fafafa' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            📷 Tienda Auditada
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#eee', border: '1px solid var(--border-light)' }}>
            <img src={job.previewUrl} alt="Tienda" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

      </div>

      {/* Tarjeta de Score Compuesto */}
      <div className="card" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
        <span className="text-xs muted" style={{ fontWeight: 800, letterSpacing: '0.05em' }}>CUMPLIMIENTO DE CONTRANTE</span>
        <h2 style={{ fontSize: '3.5rem', fontWeight: 900, color: scoreColor, lineHeight: 1.1, margin: '0.25rem 0' }}>
          {result.complianceScore}%
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <span className={`badge ${scoreBadge}`}>{result.complianceScore >= 80 ? 'APROBADO' : result.complianceScore >= 60 ? 'CONDICIONAL' : 'RECHAZADO'}</span>
          {result.photoQuality === 'poor' && <span className="badge badge--yellow">Calidad Baja</span>}
        </div>
      </div>

      {/* Grid de Métricas de Negocio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        <div className="card" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
          <div className="text-xs muted" style={{ fontWeight: 800 }}>SURTIDO</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-blue)' }}>{result.metrics.assortment}%</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
          <div className="text-xs muted" style={{ fontWeight: 800 }}>POSICIÓN</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-green)' }}>{result.metrics.positioning}%</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
          <div className="text-xs muted" style={{ fontWeight: 800 }}>PRECIOS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-yellow)' }}>{result.metrics.pricing}%</div>
        </div>
        <div className="card" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
          <div className="text-xs muted" style={{ fontWeight: 800 }}>HUECOS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: result.metrics.gaps > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{result.metrics.gaps}</div>
        </div>
      </div>

      {/* Resumen del Auditor */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-xs muted" style={{ fontWeight: 800, marginBottom: '0.25rem' }}>RESUMEN DE AUDITORÍA COMPARATIVA</div>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{result.summary}</p>
      </div>

      {/* Secciones colapsables de diferencias de planograma */}
      <div className="card" style={{ padding: '0 1rem' }}>
        
        {/* Productos Encontrados */}
        <div className="collapsible">
          <div className="collapsible-header" onClick={() => toggleSection('matches')}>
            <span>PRODUCTOS EN CUMPLIMIENTO <span className="badge badge--green" style={{ marginLeft: '0.5rem' }}>{result.matches.length}</span></span>
            <span>{openSection === 'matches' ? '▲' : '▼'}</span>
          </div>
          {openSection === 'matches' && (
            <div className="collapsible-content">
              {result.matches.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 800 }}>✓</span>
                  <span>{item.name} <span className="muted">({item.observedPosition || 'Posición Correcta'})</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Productos Faltantes */}
        <div className="collapsible">
          <div className="collapsible-header" onClick={() => toggleSection('missing')}>
            <span>PRODUCTOS FALTANTES <span className="badge badge--red" style={{ marginLeft: '0.5rem' }}>{result.missing.length}</span></span>
            <span>{openSection === 'missing' ? '▲' : '▼'}</span>
          </div>
          {openSection === 'missing' && (
            <div className="collapsible-content">
              {result.missing.length === 0 ? (
                <p className="text-xs muted">Ningún producto faltante detectado.</p>
              ) : (
                result.missing.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0', color: 'var(--accent-red)' }}>
                    <span style={{ fontWeight: 800 }}>✗</span>
                    <span>{item.name} <span className="muted">— Esperado en: {item.expectedPosition || 'Sin ubicación'}</span></span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Discrepancias de Precios */}
        <div className="collapsible">
          <div className="collapsible-header" onClick={() => toggleSection('prices')}>
            <span>DISCREPANCIAS DE PRECIOS <span className="badge badge--yellow" style={{ marginLeft: '0.5rem' }}>{result.priceDiscrepancies.length}</span></span>
            <span>{openSection === 'prices' ? '▲' : '▼'}</span>
          </div>
          {openSection === 'prices' && (
            <div className="collapsible-content">
              {result.priceDiscrepancies.length === 0 ? (
                <p className="text-xs muted">Sin discrepancias de precios.</p>
              ) : (
                result.priceDiscrepancies.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                    <span style={{ color: 'var(--accent-yellow)', fontWeight: 800 }}>$</span>
                    <span>
                      {item.name} — Esperado: <strong>${item.expectedPrice}</strong> → Visto: <strong style={{ color: 'var(--accent-red)' }}>${item.observedPrice}</strong>
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Huecos en Anaquel */}
        <div className="collapsible">
          <div className="collapsible-header" onClick={() => toggleSection('gaps')}>
            <span>HUECOS / ESPACIOS VACÍOS <span className="badge badge--red" style={{ marginLeft: '0.5rem' }}>{result.gapDetails?.length || result.metrics.gaps}</span></span>
            <span>{openSection === 'gaps' ? '▲' : '▼'}</span>
          </div>
          {openSection === 'gaps' && (
            <div className="collapsible-content">
              {(!result.gapDetails || result.gapDetails.length === 0) ? (
                <p className="text-xs muted">Sin espacios vacíos detectados.</p>
              ) : (
                result.gapDetails.map((gap, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 800 }}>◻</span>
                    <span>Hueco en: <strong>{gap.location}</strong> {gap.expectedProduct && <span className="muted">(Debería estar: {gap.expectedProduct})</span>}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
