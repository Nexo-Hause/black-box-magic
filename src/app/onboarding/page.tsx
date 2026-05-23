'use client';

import { useEffect, useRef, useState, Suspense, FormEvent, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import type { TestPhoto } from '@/hooks/useOnboardingChat';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import type { ClientConfig, EvaluationArea, EscalationRule } from '@/types/engine';
import './onboarding.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_INDUSTRIES = [
  { id: 'qsr', name: 'QSR / Comida Rápida', icon: '🍔',
    questions: [
      '¿Las mesas y áreas de comensales se ven limpias y ordenadas?',
      '¿El uniforme de los empleados (gorra, delantal) se usa correctamente?',
      '¿Los alimentos y condimentos en barra están debidamente tapados y frescos?',
      '¿El área de caja o cobro se encuentra libre de objetos personales?'
    ]
  },
  { id: 'retail_btl', name: 'Retail / BTL', icon: '🏷️',
    questions: [
      '¿El anaquel tiene los productos principales con el logotipo al frente?',
      '¿La publicidad del mes (BTL, pósteres) está visible y sin daños?',
      '¿Existe suficiente stock del producto estelar o hay huecos vacíos?',
      '¿Los precios marcados coinciden con la promoción vigente?'
    ]
  },
  { id: 'construccion', name: 'Construcción / Telecom', icon: '🚧',
    questions: [
      '¿El personal en la obra porta su casco, chaleco y botas de seguridad?',
      '¿La zona de excavación o trabajo de altura tiene barandales de seguridad?',
      '¿Las herramientas de trabajo y materiales están ordenados y clasificados?',
      '¿Existen obstrucciones en las salidas de emergencia o extintores?'
    ]
  },
  { id: 'servicios', name: 'Servicios', icon: '🛎️',
    questions: [
      '¿La zona de recepción o lobby luce limpia, despejada y ordenada?',
      '¿Los botes de basura están por debajo de su límite de capacidad?',
      '¿Las pantallas publicitarias o informativas están encendidas y operando?',
      '¿La atención y presentación del personal cumple con el protocolo de marca?'
    ]
  },
  { id: 'operaciones', name: 'Operaciones', icon: '⚙️',
    questions: [
      '¿El flujo de maquinaria o vehículos en patio está despejado de obstáculos?',
      '¿Las zonas críticas tienen señalamientos visibles de seguridad?',
      '¿El nivel de iluminación de las áreas de trabajo es óptimo y suficiente?',
      '¿Las bitácoras físicas de supervisión están firmadas y al día?'
    ]
  },
  { id: 'otros', name: 'Otros / Personalizado', icon: '🌟',
    questions: [
      '¿Cuáles son las áreas o zonas más importantes que necesitas auditar visualmente a través de fotografías?',
      '¿Qué elementos específicos de orden, limpieza o presentación deben estar presentes?',
      '¿Cuáles son las fallas operativas o condiciones críticas que consideras inaceptables?',
      '¿Qué estándares rigurosos de tu manual de marca deben cumplir los colaboradores?'
    ]
  }
];

const SCORING_LABELS: Record<ClientConfig['globalScoringMethod'], string> = {
  weighted: 'Promedio ponderado',
  equal: 'Promedio igual',
  pass_fail: 'Aprobado / Reprobado',
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: number;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="step-indicator-bar">
      <div className={`step-badge ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
        Paso 1: Reglas
      </div>
      <div className={`step-badge ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
        Paso 2: Sandbox
      </div>
      <div className={`step-badge ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
        Paso 3: Reporte
      </div>
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const badgeStyle = pct >= 80 ? 'badge badge--green' : pct >= 60 ? 'badge badge--yellow' : 'badge badge--red';
  return (
    <span className={badgeStyle} style={{ border: '2px solid var(--border)', fontWeight: 800 }}>
      {pct}% de Confianza
    </span>
  );
}

// ─── IdleView ─────────────────────────────────────────────────────────────────

// ─── IdleView ─────────────────────────────────────────────────────────────────

interface IdleViewProps {
  onStart: (param: { email: string; clientName: string }) => void;
  onResume: (sessionData: any) => void;
  loading: boolean;
}

function IdleView({ onStart, onResume, loading }: IdleViewProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'resume'>('new');
  
  // Tab 'new' state
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  
  // Tab 'resume' state
  const [resumeEmail, setResumeEmail] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleStartNew = (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !email.trim() || loading) return;
    onStart({ email: email.trim(), clientName: clientName.trim() });
  };

  const handleSearchSessions = async (e: FormEvent) => {
    e.preventDefault();
    if (!resumeEmail.trim() || searching) return;
    setSearching(true);
    setSearchError('');
    setSessions([]);
    try {
      const res = await fetch('/api/onboarding/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resumeEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al buscar sesiones');
      
      if (data.sessions && data.sessions.length > 0) {
        setSessions(data.sessions);
      } else {
        setSearchError('No se encontraron sesiones para este correo.');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error de red al buscar sesiones');
    } finally {
      setSearching(false);
    }
  };

  const handleResumeClick = async (sessionId: string) => {
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch('/api/onboarding/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reanudar sesión');
      onResume(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error al reanudar sesión');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="gate-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="gate-card neo-card" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem' }}>
        <h1 className="neo-title" style={{ justifyContent: 'center', fontSize: '1.8rem', marginBottom: '0.25rem' }}>BLACK BOX MAGIC</h1>
        <p className="gate-subtitle" style={{ textAlign: 'center', letterSpacing: '0.1em', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2rem' }}>
          ONBOARDING SELF-SERVE
        </p>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '3px solid var(--neo-border)', paddingBottom: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('new')}
            className={`neo-btn ${activeTab === 'new' ? 'neo-btn-primary' : 'neo-btn-muted'}`}
            style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.8rem', borderWidth: '2.5px' }}
          >
            Nuevo Onboarding
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`neo-btn ${activeTab === 'resume' ? 'neo-btn-primary' : 'neo-btn-muted'}`}
            style={{ flex: 1, padding: '0.6rem 0.5rem', fontSize: '0.8rem', borderWidth: '2.5px' }}
          >
            Reanudar Sesión
          </button>
        </div>

        {/* Tab Content: New */}
        {activeTab === 'new' && (
          <form onSubmit={handleStartNew} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="company-name" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Nombre de tu Empresa:</label>
              <input
                id="company-name"
                type="text"
                className="other-industry-input"
                style={{ padding: '0.65rem 0.85rem' }}
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ej. Fruit of the Loom"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="company-email" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Tu Correo Electrónico:</label>
              <input
                id="company-email"
                type="email"
                className="other-industry-input"
                style={{ padding: '0.65rem 0.85rem' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !clientName.trim() || !email.trim()}
              className="neo-btn neo-btn-success"
              style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
            >
              {loading ? 'CREANDO SESIÓN...' : 'COMENZAR ONBOARDING'}
            </button>
          </form>
        )}

        {/* Tab Content: Resume */}
        {activeTab === 'resume' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <form onSubmit={handleSearchSessions} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="resume-email" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Ingresa tu Correo Electrónico:</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="resume-email"
                  type="email"
                  className="other-industry-input"
                  style={{ padding: '0.65rem 0.85rem' }}
                  value={resumeEmail}
                  onChange={e => setResumeEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
                <button
                  type="submit"
                  disabled={searching || !resumeEmail.trim()}
                  className="neo-btn neo-btn-primary"
                  style={{ flexShrink: 0, padding: '0.65rem 1.25rem', borderWidth: '2.5px' }}
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>

            {searchError && (
              <p style={{ color: 'var(--neo-danger)', fontWeight: 800, fontSize: '0.85rem', margin: '0.5rem 0 0 0', textAlign: 'center' }}>
                {searchError}
              </p>
            )}

            {/* Session list selector */}
            {sessions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                <p style={{ fontWeight: 800, fontSize: '0.85rem', margin: '0 0 0.25rem 0' }}>Selecciona la sesión a reanudar:</p>
                {sessions.map(s => {
                  const dateStr = new Date(s.updatedAt).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={s.sessionId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        border: '2.5px solid var(--neo-border)',
                        borderRadius: '8px',
                        background: '#fafafa',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.clientName}
                        </p>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neo-muted)' }}>
                          {s.industry === 'qsr' ? '🍔 QSR' : s.industry === 'retail_btl' ? '🏷️ Retail' : '⚙️ Operaciones'} &middot; {dateStr}
                        </span>
                      </div>
                      <button
                        onClick={() => handleResumeClick(s.sessionId)}
                        disabled={searching}
                        className="neo-btn neo-btn-success"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', borderWidth: '2px', flexShrink: 0 }}
                      >
                        Ingresar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Industry Selection & Dictation ───────────────────────────────────

interface Step1ViewProps {
  loading: boolean;
  onSend: (text: string) => void;
  onStartSynthesis: () => void;
  onStartVoice: () => void;
  token: string | null;
}

function Step1View({ loading, onSend, onStartSynthesis, onStartVoice, token }: Step1ViewProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('qsr');
  const [otherIndustryText, setOtherIndustryText] = useState<string>('');
  const [customRules, setCustomRules] = useState<string>('');
  const [guidingQuestions, setGuidingQuestions] = useState<string[]>(
    STANDARD_INDUSTRIES[0].questions
  );
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);

  // Update questions when selection changes
  useEffect(() => {
    if (selectedIndustry !== 'otros') {
      const match = STANDARD_INDUSTRIES.find(ind => ind.id === selectedIndustry);
      if (match) setGuidingQuestions(match.questions);
    } else {
      setGuidingQuestions(STANDARD_INDUSTRIES.find(ind => ind.id === 'otros')!.questions);
    }
  }, [selectedIndustry]);

  // Load custom questions dynamically for "Otros"
  const handleGenerateCustomQuestions = async () => {
    if (!otherIndustryText.trim() || !token) return;
    setLoadingQuestions(true);
    try {
      const response = await fetch('/api/onboarding/guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ industry: otherIndustryText.trim() }),
      });
      const data = await response.json();
      if (data.questions && data.questions.length === 4) {
        setGuidingQuestions(data.questions);
      }
    } catch (e) {
      console.error('Error cargando preguntas dinámicas:', e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleCreateRules = () => {
    if (!customRules.trim() || loading) return;
    const finalContext = selectedIndustry === 'otros' 
      ? `Industria: ${otherIndustryText}\nReglas: ${customRules}`
      : `Industria: ${selectedIndustry}\nReglas: ${customRules}`;
    
    onSend(finalContext);
    onStartSynthesis();
  };

  return (
    <div className="neo-card">
      <StepIndicator currentStep={1} />
      
      <h2 className="neo-title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        1. Selecciona tu Industria
      </h2>
      <p className="neo-subtitle" style={{ marginBottom: '1.5rem' }}>
        Elige el sector que mejor describa tu operación de campo para guiar tus reglas de auditoría.
      </p>

      {/* Industry Selector Grid */}
      <div className="industry-grid">
        {STANDARD_INDUSTRIES.map((ind) => (
          <div
            key={ind.id}
            className={`industry-card ${selectedIndustry === ind.id ? 'active' : ''}`}
            onClick={() => setSelectedIndustry(ind.id)}
          >
            <span className="industry-card-icon">{ind.icon}</span>
            <span>{ind.name}</span>
          </div>
        ))}
      </div>

      {/* Dynamic input for "Otros" */}
      {selectedIndustry === 'otros' && (
        <div className="other-industry-input-container">
          <label className="calibration-label" htmlFor="other-industry">
            Describe tu industria o sector específico:
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              id="other-industry"
              type="text"
              className="other-industry-input"
              value={otherIndustryText}
              onChange={(e) => setOtherIndustryText(e.target.value)}
              placeholder="Ej. Gimnasios, Escuelas, Hotelería, Oficinas corporativas"
            />
            <button
              type="button"
              className="neo-btn neo-btn-primary"
              disabled={loadingQuestions || !otherIndustryText.trim()}
              onClick={handleGenerateCustomQuestions}
              style={{ flexShrink: 0, padding: '0.5rem 1rem' }}
            >
              {loadingQuestions ? 'Generando...' : 'Obtener Guía'}
            </button>
          </div>
        </div>
      )}

      {/* Guiding Questions Panel */}
      <div style={{ margin: '2rem 0' }}>
        <h3 className="calibration-label" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
          💡 Preguntas Guía para Diseñar tus Reglas:
        </h3>
        <div className="guides-container">
          {guidingQuestions.map((q, idx) => (
            <div key={idx} className="guide-card">
              {q}
            </div>
          ))}
        </div>
      </div>

      {/* Rules Custom TextArea */}
      <div className="dictation-container">
        <label className="calibration-label" style={{ fontSize: '1.1rem' }} htmlFor="custom-rules">
          Dicta o Escribe las Reglas del Negocio
        </label>
        <p className="neo-subtitle" style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
          Describe detalladamente qué debe revisar la IA en cada foto (ej. limpieza, orden, presencia de marca).
        </p>
        <textarea
          id="custom-rules"
          className="dictation-textarea"
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder="Ej: El personal debe portar obligatoriamente chaleco de seguridad y casco. No debe haber herramientas tiradas en el piso. El área de trabajo debe estar limpia..."
        />
      </div>

      {/* Voice & Dictation Control */}
      <div className="mic-button-wrapper">
        <button
          type="button"
          onClick={onStartVoice}
          className="neo-mic-button"
          title="Iniciar dictado por voz interactivo"
          aria-label="Hablar para dictar reglas"
        >
          <div className="mic-level-ring" />
          <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
          </svg>
        </button>
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--neo-muted)', marginTop: '-0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
        Haz clic en el micrófono para dictar por voz
      </p>

      {/* Submit Button */}
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleCreateRules}
          disabled={loading || !customRules.trim()}
          className="neo-btn neo-btn-success"
          style={{ width: '100%', maxWidth: '320px' }}
        >
          {loading ? 'SINTETIZANDO MOTOR...' : 'GENERAR Y CONTINUAR'}
        </button>
      </div>
    </div>
  );
}

// ─── Voice View (Interactive Dictation Mode) ──────────────────────────────────

interface VoiceViewProps {
  wsUrl: string;
  token: string;
  expiresAt?: string;
  systemPrompt: string;
  tools: unknown;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onComplete: () => void;
  onSwitchToText: () => void;
}

function VoiceView({ wsUrl, token, expiresAt, systemPrompt, tools, onTranscript, onComplete, onSwitchToText }: VoiceViewProps) {
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const [transcriptLines, setTranscriptLines] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  useEffect(() => {
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      onSwitchToText();
    }
  }, [expiresAt, onSwitchToText]);

  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant') => {
    setTranscriptLines(prev => [...prev, { role, text }]);
    onTranscript(text, role);
  }, [onTranscript]);

  const handleToolCall = useCallback((_name: string, _args: Record<string, unknown>) => {
    // Ack silently
  }, []);

  const { status, connect, disconnect, startListening, stopListening, audioLevel } = useVoiceSession({
    wsUrl,
    token,
    systemPrompt,
    tools,
    onTranscript: handleTranscript,
    onToolCall: handleToolCall,
    onComplete,
    onError: (err) => {
      setTranscriptLines(prev => [...prev, { role: 'assistant', text: `Error: ${err}` }]);
    },
  });

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  const STATUS_LABEL: Record<typeof status, string> = {
    connecting: 'Conectando con el asistente de voz...',
    connected: 'Asistente de voz listo. Presiona el micrófono para hablar.',
    listening: 'Escuchando tu voz...',
    processing: 'Procesando dictado...',
    speaking: 'Asistente respondiendo...',
    error: 'Error de conexión',
    closed: 'Sesión de voz finalizada',
  };

  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';
  const isProcessing = status === 'processing';
  const isConnecting = status === 'connecting';
  const isError = status === 'error' || status === 'closed';
  const canListen = status === 'connected' || status === 'listening';

  const levelPct = Math.min(100, Math.round(audioLevel * 600));

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else if (canListen) {
      startListening();
    }
  };

  return (
    <div className="neo-card" style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2.5px solid var(--neo-border)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isListening ? 'var(--neo-danger)' : 'var(--neo-success)',
              animation: isListening ? 'mic-pulse 1.2s infinite' : 'none'
            }}
          />
          <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <button onClick={onSwitchToText} className="neo-btn neo-btn-muted" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          Regresar a Texto
        </button>
      </div>

      {/* Voice Transcript Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#fafafa', border: '2.5px solid var(--neo-border)', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {transcriptLines.length === 0 && !isConnecting && (
          <p style={{ textAlign: 'center', color: 'var(--neo-muted)', fontWeight: 600, fontSize: '0.9rem', paddingTop: '2rem' }}>
            Háblale a BBM. Los detalles dictados aparecerán en este bloque en tiempo real.
          </p>
        )}
        {transcriptLines.map((line, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: line.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '0.75rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              lineHeight: 1.5,
              border: '2px solid var(--neo-border)',
              borderRadius: '8px',
              boxShadow: '2px 2px 0px var(--neo-shadow)',
              ...(line.role === 'user'
                ? { background: 'var(--neo-dark)', color: '#ffffff' }
                : { background: '#ffffff', color: 'var(--neo-dark)' }
              )
            }}>
              {line.text}
            </div>
          </div>
        ))}
        <div ref={transcriptBottomRef} />
      </div>

      {/* Mic Animation Controller */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {isListening && (
          <div className="progress-bar" style={{ width: '100%', maxWidth: '240px', border: '2.5px solid var(--neo-border)', background: '#e2e8f0', height: '14px', borderRadius: '8px', overflow: 'hidden' }}>
            <div className="progress-bar__fill" style={{ width: `${levelPct}%`, background: 'var(--neo-danger)', height: '100%', transition: 'width 75ms' }} />
          </div>
        )}

        {!isError && (
          <button
            onClick={handleMicPress}
            disabled={!canListen || isConnecting}
            className={`neo-mic-button ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
            aria-pressed={isListening}
            style={{ width: '84px', height: '84px' }}
          >
            {isSpeaking ? (
              <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 0 1 0 7.072M18.364 5.636a9 9 0 0 1 0 12.728M11 5L6 9H3v6h3l5 4V5z" />
              </svg>
            ) : isProcessing ? (
              <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
            ) : (
              <svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
              </svg>
            )}
          </button>
        )}

        {isError && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--neo-danger)', fontWeight: 800, marginBottom: '1rem' }}>
              La sesión de voz ha concluido o tuvo un error.
            </p>
            <button onClick={onSwitchToText} className="neo-btn neo-btn-primary">
              CONTINUAR POR TEXTO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Synthesizing View ────────────────────────────────────────────────────────

interface SynthesizingViewProps {
  progress: string;
}

function SynthesizingView({ progress }: SynthesizingViewProps) {
  return (
    <div className="neo-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '4px', margin: '0 auto 1.5rem auto' }} />
      <h3 className="neo-title" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>
        {progress || 'Generando tu motor de auditoría visual...'}
      </h3>
      <p className="neo-subtitle" style={{ fontSize: '0.95rem' }}>
        Gemini 3.5 Flash está analizando tus reglas y construyendo un perfil robusto. Esto tomará unos segundos.
      </p>
    </div>
  );
}

// ─── Reviewing / Testing View (Sandbox de Fotos) ──────────────────────────────

interface TestingViewProps {
  photos: TestPhoto[];
  iterationCount: number;
  onAddPhoto: (file: File) => Promise<void>;
  onRate: (photoId: string, rating: 'ok' | 'no', feedback?: string) => void;
  onDeploy: () => void;
  onAdjust: () => void;
  onModify: () => void;
  config: ClientConfig | null;
  gaps: string[];
  confidence: number;
  openCalibrationDrawer: () => void;
  historyList: any[];
  onResumeSession: (sessionId: string) => Promise<void>;
  currentSessionId: string | null;
}

function TestingView({
  photos,
  iterationCount,
  onAddPhoto,
  onRate,
  onDeploy,
  onAdjust,
  onModify,
  config,
  gaps,
  confidence,
  openCalibrationDrawer,
  historyList,
  onResumeSession,
  currentSessionId
}: TestingViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach(f => onAddPhoto(f));
  }, [onAddPhoto]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const allDone = photos.length > 0 && photos.every(p => p.status === 'done' || p.status === 'error');
  const allRated = allDone && photos.filter(p => p.status === 'done').every(p => p.rating !== null);
  const hasNoRatings = photos.some(p => p.rating === 'no');
  const canDeploy = allRated && !hasNoRatings;
  const canAdjust = allRated && hasNoRatings;
  const MAX_PHOTOS = 100;

  return (
    <div className="neo-card">
      <StepIndicator currentStep={2} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="neo-title" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
            2. Sandbox de Pruebas
          </h2>
          <p className="neo-subtitle" style={{ marginBottom: 0 }}>
            Sube fotos de prueba para validar en tiempo real cómo responde la IA a tus criterios.
          </p>
          {iterationCount > 0 && (
            <span className="badge badge--yellow" style={{ border: '2px solid var(--border)', fontWeight: 800, marginTop: '0.5rem', display: 'inline-block' }}>
              Ronda de Calibración #{iterationCount}
            </span>
          )}
        </div>
        {config && <ConfidenceBadge confidence={confidence} />}
      </div>

      {/* Upload zone */}
      {photos.length < MAX_PHOTOS && (
        <div
          className={`sandbox-dropzone ${dragActive ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
          <span className="sandbox-dropzone-icon">📸</span>
          <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            {dragActive ? '¡Suelta tus fotos aquí!' : 'Arrastra tus fotos de campo aquí o haz clic para buscar'}
          </h3>
          <p className="text-sm muted" style={{ fontWeight: 600 }}>
            PNG, JPG o WebP &middot; Máx 10MB por foto &middot; Sandbox Libre ({photos.length} / {MAX_PHOTOS} subidas)
          </p>
        </div>
      )}

      {/* Sandbox Photo Grid */}
      {photos.length > 0 && (
        <div className="sandbox-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-card">
              <div className="photo-card-header">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={photo.fileName} className="photo-card-thumb" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {photo.fileName}
                  </p>
                  {photo.status === 'done' && photo.result && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: photo.result.passed ? 'var(--neo-success-hover)' : 'var(--neo-danger)' }}>
                      Puntaje: {Math.round(photo.result.globalScore)}% ({photo.result.passed ? 'Cumple' : 'Rechazado'})
                    </span>
                  )}
                  {photo.status === 'analyzing' && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neo-primary)' }}>Analizando con IA...</span>}
                  {photo.status === 'pending' && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neo-muted)' }}>En cola...</span>}
                  {photo.status === 'error' && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neo-danger)' }}>Error en análisis</span>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {photo.status === 'done' && photo.rating === null && (
                    <button
                      onClick={() => setExpandedId(prev => prev === photo.id ? null : photo.id)}
                      className="neo-btn neo-btn-muted"
                      style={{ padding: '0.25rem 0.5rem', borderWidth: '2px', fontSize: '0.75rem' }}
                    >
                      {expandedId === photo.id ? '▲ Ver menos' : '▼ Ver detalles'}
                    </button>
                  )}
                  {photo.status === 'done' && photo.rating === 'ok' && (
                    <span className="badge badge--green" style={{ border: '2px solid var(--border)', fontWeight: 800 }}>Aprobado</span>
                  )}
                  {photo.status === 'done' && photo.rating === 'no' && (
                    <span className="badge badge--red" style={{ border: '2px solid var(--border)', fontWeight: 800 }}>Reportado</span>
                  )}
                </div>
              </div>

              {/* Expansion block */}
              {photo.status === 'done' && photo.result && (expandedId === photo.id || photo.rating === null) && photo.rating === null && (
                <div className="photo-card-body" style={{ borderTop: '2.5px solid var(--neo-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Clean Visual Analysis Summary */}
                  <h4 style={{ fontWeight: 800, fontSize: '0.9rem', margin: 0 }}>Reporte de Visión:</h4>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: 0, fontWeight: 500 }}>
                    {photo.result.summary}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: '#f8fafc', padding: '0.5rem', border: '2px solid var(--neo-border)', borderRadius: '6px' }}>
                    {photo.result.areas.map(area => (
                      <div key={area.areaId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--neo-muted)' }}>{area.areaName}</span>
                        <span style={{ color: area.passed ? 'var(--neo-success-hover)' : 'var(--neo-danger)' }}>
                          {Math.round(area.score)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Sandbox rating checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0 }}>¿El dictamen de la IA es correcto?</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          onRate(photo.id, 'ok');
                          setExpandedId(null);
                        }}
                        className="neo-btn neo-btn-success"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                      >
                        Sí, coincide
                      </button>
                      <button
                        onClick={() => setExpandedId(photo.id)}
                        className="neo-btn neo-btn-danger"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                      >
                        No coincide
                      </button>
                    </div>

                    {/* Calibrate feedback input */}
                    {expandedId === photo.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', borderTop: '2px dashed var(--neo-border)', paddingTop: '0.5rem' }}>
                        <label className="calibration-label" style={{ fontSize: '0.75rem' }} htmlFor={`feedback-${photo.id}`}>
                          ¿Qué ignoró la IA o en qué se equivocó?
                        </label>
                        <input
                          id={`feedback-${photo.id}`}
                          type="text"
                          className="other-industry-input"
                          style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                          value={feedbackMap[photo.id] ?? ''}
                          onChange={e => setFeedbackMap(prev => ({ ...prev, [photo.id]: e.target.value }))}
                          placeholder="Ej. Omitió evaluar que la mesa del fondo estaba sucia"
                        />
                        <button
                          onClick={() => {
                            onRate(photo.id, 'no', feedbackMap[photo.id] ?? '');
                            setExpandedId(null);
                          }}
                          disabled={!feedbackMap[photo.id]?.trim()}
                          className="neo-btn neo-btn-danger"
                          style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                        >
                          Confirmar Error
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Global Actions for Step 2 */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem', borderTop: '3px solid var(--neo-border)', paddingTop: '1.5rem' }}>
          {canDeploy && (
            <button onClick={onDeploy} className="neo-btn neo-btn-success" style={{ width: '100%', maxWidth: '320px' }}>
              ✔ APROBAR Y DESPLEGAR MOTOR
            </button>
          )}
          {canAdjust && iterationCount < 5 && (
            <button onClick={openCalibrationDrawer} className="neo-btn neo-btn-warning" style={{ width: '100%', maxWidth: '320px' }}>
              ⚡ MODIFICAR Y RE-CALIBRAR
            </button>
          )}
          {canAdjust && iterationCount >= 5 && (
            <div className="neo-card" style={{ background: '#fee2e2', border: '2px solid var(--neo-danger)', padding: '0.75rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <p style={{ color: 'var(--neo-danger)', fontWeight: 800, margin: 0, fontSize: '0.85rem' }}>
                Límite de iteraciones gratuitas alcanzado. Contacta soporte para ampliar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Historial de Versiones */}
      {historyList.length > 1 && (
        <div style={{ marginTop: '2.5rem', borderTop: '2px dashed var(--neo-border)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⏳ Historial de Versiones y Calibraciones
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {historyList.map((hist) => {
              const isActive = hist.id === currentSessionId;
              const dateStr = new Date(hist.createdAt).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });
              return (
                <div
                  key={hist.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: isActive ? '2.5px solid var(--neo-primary)' : '2px solid var(--neo-border)',
                    borderRadius: '8px',
                    background: isActive ? '#eff6ff' : '#ffffff',
                    boxShadow: isActive ? '2px 2px 0px var(--neo-primary)' : '2px 2px 0px var(--neo-border)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                      Versión {hist.version} {hist.status === 'active' ? ' (Activa)' : hist.status === 'draft' ? ' (Borrador)' : ''}
                    </span>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--neo-muted)', fontWeight: 600 }}>
                      Modificado el {dateStr}
                    </p>
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => onResumeSession(hist.id)}
                      className="neo-btn neo-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderWidth: '2px', flexShrink: 0 }}
                    >
                      Cargar Versión
                    </button>
                  )}
                  {isActive && (
                    <span className="badge badge--green" style={{ border: '2px solid var(--border)', fontWeight: 800, fontSize: '0.7rem', flexShrink: 0 }}>
                      Actual
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calibration Drawer Panel (Slide-out Overlay) ────────────────────────────

interface CalibrationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCalibration: (severity: string, omissions: string, pajaOptions: Record<string, boolean>) => void;
}

function CalibrationDrawer({ isOpen, onClose, onSubmitCalibration }: CalibrationDrawerProps) {
  const [severity, setSeverity] = useState<string>('adecuado');
  const [omissions, setOmissions] = useState<string>('');
  const [pajaOptions, setPajaOptions] = useState<Record<string, boolean>>({
    iluminacion: false,
    seguridad: false,
    competencia: false,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmitCalibration(severity, omissions, pajaOptions);
    onClose();
  };

  return (
    <div className="calibration-sidebar-overlay" onClick={onClose}>
      <div className="calibration-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">Bucle de Calibración</h3>
          <button className="sidebar-close-btn" onClick={onClose}>X</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Severity Input */}
          <div className="calibration-form-group">
            <label className="calibration-label" htmlFor="calibrate-severity">
              Ajuste de Rigidez / Severidad
            </label>
            <select
              id="calibrate-severity"
              className="calibration-select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="tolerante">Demasiado Tolerante (Calificación Amigable)</option>
              <option value="adecuado">Nivel Adecuado (Normal)</option>
              <option value="estricto">Demasiado Estricto (Criterio Riguroso)</option>
            </select>
          </div>

          {/* Omissions Input */}
          <div className="calibration-form-group">
            <label className="calibration-label" htmlFor="calibrate-omissions">
              ¿Qué omitió la IA o qué áreas faltaron?
            </label>
            <textarea
              id="calibrate-omissions"
              className="calibration-textarea"
              value={omissions}
              onChange={(e) => setOmissions(e.target.value)}
              placeholder="Ej. Ignoró que los botes de basura estaban desbordados o que los precios en carteles no eran legibles..."
            />
          </div>

          {/* Clean Paja Checklist */}
          <div className="calibration-form-group">
            <label className="calibration-label">
              Descarte de Paja (Quitar análisis innecesarios)
            </label>
            <div className="paja-checkbox-group">
              <label className="paja-checkbox-label">
                <input
                  type="checkbox"
                  className="paja-checkbox"
                  checked={pajaOptions.iluminacion}
                  onChange={(e) => setPajaOptions(prev => ({ ...prev, iluminacion: e.target.checked }))}
                />
                Eliminar análisis de iluminación de foto
              </label>
              <label className="paja-checkbox-label">
                <input
                  type="checkbox"
                  className="paja-checkbox"
                  checked={pajaOptions.seguridad}
                  onChange={(e) => setPajaOptions(prev => ({ ...prev, seguridad: e.target.checked }))}
                />
                Eliminar teoría técnica sobre seguridad física
              </label>
              <label className="paja-checkbox-label">
                <input
                  type="checkbox"
                  className="paja-checkbox"
                  checked={pajaOptions.competencia}
                  onChange={(e) => setPajaOptions(prev => ({ ...prev, competencia: e.target.checked }))}
                />
                Omitir detección de marcas de competidores
              </label>
            </div>
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <button type="submit" className="neo-btn neo-btn-success" style={{ width: '100%' }}>
              ✔ APLICAR Y RE-CALIBRAR MOTOR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deploying View ──────────────────────────────────────────────────────────

function DeployingView() {
  return (
    <div className="neo-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '4px', margin: '0 auto 1.5rem auto' }} />
      <h3 className="neo-title" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>
        Desplegando tu motor en producción...
      </h3>
      <p className="neo-subtitle" style={{ fontSize: '0.95rem' }}>
        Activando los perfiles de scoring visual para tus sucursales. Esto tomará sólo un momento.
      </p>
    </div>
  );
}

// ─── Approved View ───────────────────────────────────────────────────────────

interface ApprovedViewProps {
  config: ClientConfig;
}

function ApprovedView({ config }: ApprovedViewProps) {
  return (
    <div className="neo-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        border: '3px solid var(--neo-success)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.5rem auto',
        background: '#d1fae5'
      }}>
        <svg style={{ width: '36px', height: '36px', color: 'var(--neo-success-hover)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h2 className="neo-title" style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.5rem' }}>
        ¡Motor Activado y Desplegado!
      </h2>
      <p className="neo-subtitle" style={{ fontSize: '1rem', marginBottom: '2rem' }}>
        El perfil de auditoría visual para <span style={{ fontWeight: 800, color: 'var(--neo-dark)' }}>{config.clientName}</span> está activo y listo para procesar visitas.
      </p>

      <div className="card" style={{ border: '2.5px solid var(--neo-border)', borderRadius: '8px', padding: '1.5rem', maxWidth: '440px', margin: '0 auto', textAlign: 'left', background: '#fafafa' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--neo-muted)' }}>Industria: </span>
          <span style={{ textTransform: 'capitalize', fontWeight: 800 }}>{config.industry.replace('_', ' ')}</span>
        </p>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--neo-muted)' }}>Espacios de Auditoría: </span>
          <span style={{ fontWeight: 800 }}>{config.evaluationAreas.length} Áreas</span>
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--neo-muted)' }}>Método de Scoring: </span>
          <span style={{ fontWeight: 800 }}>{SCORING_LABELS[config.globalScoringMethod]}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="neo-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fee2e2',
        borderColor: 'var(--neo-danger)',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '4px 4px 0px var(--neo-danger)',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'var(--neo-danger)', fontWeight: 900, fontSize: '1.25rem' }}>⚠</span>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{message}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Cerrar error"
        style={{
          background: 'none',
          border: '2px solid var(--neo-border)',
          borderRadius: '4px',
          fontWeight: 900,
          cursor: 'pointer',
          padding: '0.2rem 0.5rem',
        }}
      >
        X
      </button>
    </div>
  );
}

// ─── Inner page (uses useSearchParams) ───────────────────────────────────────

function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const {
    state,
    startSession,
    resumeSession,
    sendMessage,
    startSynthesis,
    approveConfig,
    requestModification,
    resetError,
    startTesting,
    addTestPhoto,
    rateTestResult,
    deployConfig,
    requestAdjustment,
    startVoiceSession,
    endVoiceSession,
  } = useOnboardingChat();

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // S6: Auto-login if code exists in URL (bypass tabs)
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (code && uuidRegex.test(code)) {
      startSession(code);
    }
  }, [code, startSession]);

  const fetchHistory = useCallback(async () => {
    if (!state.token || (state.phase !== 'testing' && state.phase !== 'reviewing')) return;
    try {
      const res = await fetch('/api/onboarding/session/history', {
        headers: { Authorization: `Bearer ${state.token}` }
      });
      const data = await res.json();
      if (res.ok && data.history) {
        setHistoryList(data.history);
      }
    } catch (err) {
      console.error('Error fetching config history:', err);
    }
  }, [state.token, state.phase]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, state.sessionId, state.synthesizedConfig]);

  const handleLoadHistoricalVersion = async (sessionId: string) => {
    try {
      const res = await fetch('/api/onboarding/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar versión histórica');
      resumeSession(data);
    } catch (err) {
      console.error('Error resuming historical session:', err);
    }
  };

  const handleStartVoice = () => {
    startVoiceSession();
  };

  const handleSwitchToText = () => {
    endVoiceSession();
  };

  const handleVoiceTranscript = useCallback(
    (text: string, role: 'user' | 'assistant') => {
      if (role === 'user') {
        sendMessage(text);
      }
    },
    [sendMessage],
  );

  const handleApplyCalibration = (severity: string, omissions: string, pajaOptions: Record<string, boolean>) => {
    // Generate instruction string based on calibration adjustments
    const cleanPajaStr = Object.entries(pajaOptions)
      .filter(([_, enabled]) => enabled)
      .map(([opt]) => opt === 'iluminacion' ? 'iluminación de la foto' : opt === 'seguridad' ? 'teoría técnica laboral' : 'competencia')
      .join(', ');

    const calibrationFeedback = `[AJUSTE DE CALIBRACIÓN]:
- Nivel de Severidad / Rigidez: ${severity}
- Omisiones detectadas: ${omissions || 'Ninguna'}
- Quitar paja de: ${cleanPajaStr || 'Ninguna'}`;

    // Dispatches adjustment message to synthesiser
    requestAdjustment(); // Transitions back to chatting state & clears sandbox photos
    sendMessage(calibrationFeedback);
    startSynthesis(); // Fires off the automatic re-synthesis
  };

  return (
    <div className="onboarding-wrapper">
      <div className="onboarding-container">
        {/* Error banner */}
        {state.error && (
          <ErrorBanner message={state.error} onDismiss={resetError} />
        )}

        {state.phase === 'idle' && (
          <IdleView onStart={startSession} onResume={resumeSession} loading={state.loading} />
        )}

        {state.phase === 'chatting' && !state.voiceMode && (
          <Step1View
            loading={state.loading}
            onSend={sendMessage}
            onStartSynthesis={startSynthesis}
            onStartVoice={handleStartVoice}
            token={state.token}
          />
        )}

        {state.phase === 'chatting' && state.voiceMode && state.voiceSession && (
          <VoiceView
            wsUrl={state.voiceSession.wsUrl}
            token={state.voiceSession.token}
            expiresAt={state.voiceSession.expiresAt}
            systemPrompt={state.voiceSession.systemPrompt}
            tools={state.voiceSession.tools}
            onTranscript={handleVoiceTranscript}
            onComplete={startSynthesis}
            onSwitchToText={handleSwitchToText}
          />
        )}

        {state.phase === 'synthesizing' && (
          <SynthesizingView progress={state.synthesisProgress} />
        )}

        {(state.phase === 'reviewing' || state.phase === 'testing') && (
          <TestingView
            photos={state.testPhotos}
            iterationCount={state.iterationCount}
            onAddPhoto={addTestPhoto}
            onRate={rateTestResult}
            onDeploy={deployConfig}
            onAdjust={requestAdjustment}
            onModify={requestModification}
            config={state.synthesizedConfig}
            gaps={state.gaps}
            confidence={state.confidence}
            openCalibrationDrawer={() => setIsDrawerOpen(true)}
            historyList={historyList}
            onResumeSession={handleLoadHistoricalVersion}
            currentSessionId={state.sessionId}
          />
        )}

        {state.phase === 'deploying' && <DeployingView />}

        {state.phase === 'approved' && state.synthesizedConfig && (
          <ApprovedView config={state.synthesizedConfig} />
        )}

        {/* Side-Drawer Calibration overlay */}
        <CalibrationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSubmitCalibration={handleApplyCalibration}
        />
      </div>
    </div>
  );
}

// ─── Page (with Suspense boundary for useSearchParams) ────────────────────────

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', minHeight: '100vh', background: '#f5f5f7' }}>
          <div
            role="status"
            aria-label="Cargando"
            className="spinner"
            style={{ width: '48px', height: '48px', borderWidth: '4px', borderTopColor: '#3b82f6' }}
          />
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}
