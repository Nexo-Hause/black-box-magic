'use client';

import { useEffect, useRef, useState, Suspense, FormEvent, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
import type { TestPhoto } from '@/hooks/useOnboardingChat';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import type { ClientConfig, EvaluationArea, EscalationRule } from '@/types/engine';

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '0.75rem 1rem',
      background: 'var(--bg-white)',
      border: '2px solid var(--border-light)',
    }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="spinner"
          style={{
            width: '6px',
            height: '6px',
            borderWidth: '1px',
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const badgeClass =
    pct >= 80 ? 'badge badge--green' :
    pct >= 60 ? 'badge badge--yellow' :
                'badge badge--red';
  return (
    <span className={badgeClass}>
      {pct}% confianza
    </span>
  );
}

// ─── Evaluation area card ─────────────────────────────────────────────────────

function AreaCard({ area }: { area: EvaluationArea }) {
  const weightPct = Math.round(area.weight * 100);
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{area.name}</h3>
          {area.description && (
            <p className="text-sm muted" style={{ marginTop: '0.25rem' }}>{area.description}</p>
          )}
        </div>
        <span className="badge badge--blue" style={{ flexShrink: 0 }}>
          {weightPct}%
        </span>
      </div>
      {area.criteria.length > 0 && (
        <ul style={{ listStyle: 'none', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {area.criteria.map(c => {
            const typeClass =
              c.type === 'binary' ? 'badge badge--neutral' :
              c.type === 'scale'  ? 'badge badge--blue' :
              c.type === 'count'  ? 'badge badge--yellow' :
                                    'badge badge--neutral';
            return (
              <li key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span className={typeClass} style={{ flexShrink: 0 }}>
                  {c.type}
                </span>
                <span>
                  {c.name}
                  {c.critical && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>
                      crítico
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Escalation rule item ─────────────────────────────────────────────────────

function EscalationRuleItem({ rule }: { rule: EscalationRule }) {
  const severityColor =
    rule.severity === 'critical' ? 'var(--accent-red)' :
    rule.severity === 'high'     ? 'var(--accent-yellow)' :
    rule.severity === 'medium'   ? 'var(--accent-yellow)' :
                                   'var(--text-muted)';
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem' }}>
      <span style={{ flexShrink: 0, fontWeight: 600, textTransform: 'capitalize', color: severityColor }}>
        {rule.severity}
      </span>
      <span className="muted">&mdash;</span>
      <span>{rule.description}</span>
    </li>
  );
}

// ─── Scoring method label ─────────────────────────────────────────────────────

const SCORING_LABELS: Record<ClientConfig['globalScoringMethod'], string> = {
  weighted:   'Promedio ponderado',
  equal:      'Promedio igual',
  pass_fail:  'Aprobado / Reprobado',
};

// ─── Phase views ──────────────────────────────────────────────────────────────

interface IdleViewProps {
  onStart: () => void;
  loading: boolean;
}

function IdleView({ onStart, loading }: IdleViewProps) {
  return (
    <div className="gate-container">
      <div className="gate-card">
        <h1 className="gate-title">BLACK BOX MAGIC</h1>
        <p className="gate-subtitle" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Onboarding
        </p>
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          marginBottom: '2rem',
          maxWidth: '400px',
        }}>
          Vamos a configurar el analisis visual para tu operacion. Te hare algunas preguntas
          para entender que es lo mas importante en tu negocio.
        </p>
        <button
          onClick={onStart}
          disabled={loading}
          className="btn btn--primary gate-btn"
        >
          {loading ? 'CARGANDO...' : 'COMENZAR'}
        </button>
      </div>
    </div>
  );
}

interface ChatViewProps {
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  loading: boolean;
  isComplete: boolean;
  onSend: (text: string) => void;
  onStartSynthesis: () => void;
  onStartVoice: () => void;
}

function ChatView({ messages, loading, isComplete, onSend, onStartSynthesis, onStartVoice }: ChatViewProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    onSend(text);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 4rem)' }}>
      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversacion de onboarding"
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: '1rem',
          paddingBottom: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                border: '2px solid var(--border)',
                ...(msg.role === 'user'
                  ? { background: 'var(--text)', color: 'var(--bg-white)' }
                  : { background: 'var(--bg-white)', color: 'var(--text)' }
                ),
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Complete banner */}
      {isComplete && !loading && (
        <div style={{
          background: 'var(--bg-white)',
          border: '2px solid var(--accent-green)',
          padding: '1rem',
          marginBottom: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <p style={{ color: 'var(--accent-green)', fontSize: '0.875rem', flex: 1, fontWeight: 600 }}>
            Tengo suficiente informacion para generar tu configuracion.
          </p>
          <button
            onClick={onStartSynthesis}
            className="btn btn--primary"
            style={{ minHeight: '44px' }}
          >
            GENERAR CONFIGURACION
          </button>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <label htmlFor="chat-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          Escribe tu respuesta
        </label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu respuesta..."
          disabled={loading}
          autoComplete="off"
          className="gate-input"
          style={{ flex: 1, minHeight: '44px' }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
          className="btn btn--primary"
          style={{ minHeight: '44px', minWidth: '44px', padding: '0.75rem' }}
        >
          &rarr;
        </button>
        {/* Mic button */}
        <button
          type="button"
          onClick={onStartVoice}
          disabled={loading}
          aria-label="Cambiar a modo de voz"
          title="Hablar con el asistente"
          className="btn btn--secondary"
          style={{ minHeight: '44px', minWidth: '44px', padding: '0.75rem' }}
        >
          <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
          </svg>
        </button>
      </form>
    </div>
  );
}

// ─── Voice view ───────────────────────────────────────────────────────────────

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
    // Tool calls are handled server-side during synthesis; we just acknowledge silently
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

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => { disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  const STATUS_LABEL: Record<typeof status, string> = {
    connecting:  'Conectando con el asistente de voz...',
    connected:   'Presiona el microfono para hablar',
    listening:   'Escuchando...',
    processing:  'Procesando tu respuesta...',
    speaking:    'Respondiendo...',
    error:       'Error de conexion',
    closed:      'Sesion cerrada',
  };

  const isListening  = status === 'listening';
  const isSpeaking   = status === 'speaking';
  const isProcessing = status === 'processing';
  const isConnecting = status === 'connecting';
  const isError      = status === 'error' || status === 'closed';
  const canListen    = status === 'connected' || status === 'listening';

  const levelPct = Math.min(100, Math.round(audioLevel * 600));

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else if (canListen) {
      startListening();
    }
  };

  // Status indicator color
  const statusDotColor =
    isConnecting               ? 'var(--accent-yellow)' :
    isError                    ? 'var(--accent-red)' :
    isSpeaking || isProcessing ? 'var(--accent-blue)' :
    isListening                ? 'var(--accent-green)' :
                                 'var(--accent-green)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 4rem)' }}>
      {/* Status announcement for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {STATUS_LABEL[status]}
      </div>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            aria-hidden="true"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusDotColor,
            }}
          />
          <span className="text-sm muted">{STATUS_LABEL[status]}</span>
        </div>
        <button
          onClick={onSwitchToText}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Cambiar a texto
        </button>
      </div>

      {/* Transcript */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Transcripcion de la conversacion de voz"
        className="card"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        {transcriptLines.length === 0 && !isConnecting && (
          <p className="muted" style={{ textAlign: 'center', fontSize: '0.85rem', paddingTop: '2rem' }}>
            La conversacion aparecera aqui
          </p>
        )}
        {transcriptLines.map((line, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: line.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              border: '2px solid var(--border)',
              ...(line.role === 'user'
                ? { background: 'var(--text)', color: 'var(--bg-white)' }
                : { background: 'var(--bg-white)', color: 'var(--text)' }
              ),
            }}>
              {line.text}
            </div>
          </div>
        ))}
        <div ref={transcriptBottomRef} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: '1rem' }}>
        {/* Audio level bar */}
        {isListening && (
          <div className="progress-bar" style={{ width: '100%', maxWidth: '200px' }}>
            <div className="progress-bar__fill" style={{ width: `${levelPct}%`, transition: 'width 75ms' }} />
          </div>
        )}

        {/* Mic button */}
        {!isError && (
          <button
            onClick={handleMicPress}
            disabled={!canListen || isConnecting}
            aria-label={isListening ? 'Detener grabacion' : 'Iniciar grabacion'}
            aria-pressed={isListening}
            className="btn"
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--border)',
              background: isListening ? 'var(--accent-green)' : 'var(--bg-white)',
              color: isListening ? 'var(--bg-white)' : 'var(--text)',
              position: 'relative',
            }}
          >
            {/* Icon */}
            {isSpeaking ? (
              <svg style={{ width: '28px', height: '28px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 0 1 0 7.072M18.364 5.636a9 9 0 0 1 0 12.728M11 5L6 9H3v6h3l5 4V5z" />
              </svg>
            ) : isProcessing ? (
              <div className="spinner" aria-hidden="true" />
            ) : (
              <svg style={{ width: '28px', height: '28px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
              </svg>
            )}
          </button>
        )}

        {/* Error fallback */}
        {isError && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--accent-red)', fontSize: '0.875rem' }}>{STATUS_LABEL[status]}</p>
            <button
              onClick={onSwitchToText}
              className="btn btn--secondary"
              style={{ minHeight: '44px' }}
            >
              CONTINUAR POR TEXTO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Synthesizing view ───────────────────────────────────────────────────────

interface SynthesizingViewProps {
  progress: string;
}

function SynthesizingView({ progress }: SynthesizingViewProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      paddingTop: '4rem',
      paddingBottom: '4rem',
      textAlign: 'center',
    }}>
      <div
        role="status"
        aria-label="Generando configuracion"
        className="spinner"
        style={{ width: '40px', height: '40px', borderWidth: '4px' }}
      />
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{progress || 'Analizando tu conversacion...'}</p>
        <p className="text-sm muted">Este paso toma aproximadamente 2 minutos</p>
      </div>
    </div>
  );
}

// ─── Reviewing view ──────────────────────────────────────────────────────────

interface ReviewingViewProps {
  config: ClientConfig;
  gaps: string[];
  confidence: number;
  onApprove: () => void;
  onModify: () => void;
}

function ReviewingView({ config, gaps, confidence, onApprove, onModify }: ReviewingViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Tu configuracion</h2>
            <p className="text-sm muted" style={{ marginTop: '0.25rem' }}>{config.clientName}</p>
          </div>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <p className="text-sm muted" style={{ marginTop: '0.5rem' }}>
          Metodo de puntuacion:{' '}
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {SCORING_LABELS[config.globalScoringMethod]}
          </span>
          {config.passingScore !== undefined && (
            <> &middot; Aprobacion desde <span style={{ fontWeight: 600, color: 'var(--text)' }}>{config.passingScore}%</span></>
          )}
        </p>
      </div>

      {/* Evaluation areas */}
      <div>
        <h3 style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: '0.75rem',
        }}>
          Areas de evaluacion
        </h3>
        {config.evaluationAreas.map(area => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>

      {/* Escalation rules */}
      {config.escalationRules.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
          }}>
            Reglas de escalacion
          </h3>
          <div className="card" style={{ padding: '1rem' }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {config.escalationRules.map(rule => (
                <EscalationRuleItem key={rule.id} rule={rule} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="truncation-banner" style={{
          background: '#fef3c7',
          borderColor: 'var(--accent-yellow)',
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Informacion pendiente
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {gaps.map((gap, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{
                  marginTop: '0.35rem',
                  flexShrink: 0,
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent-yellow)',
                  display: 'inline-block',
                }} />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <button
          onClick={onApprove}
          className="btn btn--primary"
          style={{ width: '100%', minHeight: '44px' }}
        >
          APROBAR Y PROBAR
        </button>
        <button
          onClick={onModify}
          className="btn btn--secondary"
          style={{ width: '100%', minHeight: '44px' }}
        >
          MODIFICAR
        </button>
      </div>
    </div>
  );
}

// ─── Testing view ─────────────────────────────────────────────────────────────

interface TestingViewProps {
  photos: TestPhoto[];
  iterationCount: number;
  onAddPhoto: (file: File) => Promise<void>;
  onRate: (photoId: string, rating: 'ok' | 'no', feedback?: string) => void;
  onDeploy: () => void;
  onAdjust: () => void;
}

function TestingView({ photos, iterationCount, onAddPhoto, onRate, onDeploy, onAdjust }: TestingViewProps) {
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
  const MAX_PHOTOS = 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Prueba tu configuracion</h2>
        <p className="text-sm muted" style={{ marginTop: '0.25rem' }}>
          Sube 5-10 fotos de tus visitas de campo para verificar que el analisis funciona correctamente.
        </p>
        {iterationCount > 0 && (
          <p style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>
            Iteracion {iterationCount} de 5
          </p>
        )}
      </div>

      {/* Upload area */}
      {photos.length < MAX_PHOTOS && (
        <div
          className={`drop-zone${dragActive ? ' drop-zone--active' : ''}`}
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
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128247;</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            {dragActive ? 'Suelta las fotos aqui' : 'Arrastra fotos o haz clic para seleccionar'}
          </div>
          <div className="text-sm muted">JPEG, PNG o WebP &middot; max. 10 MB &middot; {photos.length}/{MAX_PHOTOS} fotos</div>
        </div>
      )}

      {/* Photo list */}
      {photos.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {photos.map(photo => (
            <li key={photo.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Photo row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}>
                {/* Thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  style={{
                    width: '48px',
                    height: '48px',
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: '1px solid var(--border-light)',
                  }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.fileName}
                  </p>
                  {photo.status === 'done' && photo.result && (
                    <p className="text-xs muted" style={{ marginTop: '0.15rem' }}>
                      Puntaje:{' '}
                      <span style={{ color: photo.result.passed ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                        {Math.round(photo.result.globalScore)}%
                      </span>
                      {' \u00b7 '}
                      <span style={{ color: photo.result.passed ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                        {photo.result.passed ? 'Aprobado' : 'Reprobado'}
                      </span>
                    </p>
                  )}
                  {photo.status === 'error' && (
                    <p className="text-xs" style={{ color: 'var(--accent-red)', marginTop: '0.15rem' }}>Error al analizar</p>
                  )}
                  {photo.status === 'analyzing' && (
                    <p className="text-xs" style={{ color: 'var(--accent-blue)', marginTop: '0.15rem' }}>Analizando...</p>
                  )}
                  {photo.status === 'pending' && (
                    <p className="text-xs muted" style={{ marginTop: '0.15rem' }}>En cola</p>
                  )}
                </div>

                {/* Status indicator */}
                <div style={{ flexShrink: 0 }}>
                  {photo.status === 'analyzing' && (
                    <div
                      role="status"
                      aria-label="Analizando"
                      className="spinner"
                      style={{ width: '18px', height: '18px', borderWidth: '2px' }}
                    />
                  )}
                  {photo.status === 'done' && photo.rating === null && (
                    <button
                      onClick={() => setExpandedId(prev => prev === photo.id ? null : photo.id)}
                      aria-label="Ver resultado"
                      className="btn btn--small"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      {expandedId === photo.id ? '\u25B2' : '\u25BC'}
                    </button>
                  )}
                  {photo.status === 'done' && photo.rating === 'ok' && (
                    <span className="badge badge--green">OK</span>
                  )}
                  {photo.status === 'done' && photo.rating === 'no' && (
                    <span className="badge badge--red">NO</span>
                  )}
                </div>
              </div>

              {/* Expanded result + rating */}
              {photo.status === 'done' && photo.result && (expandedId === photo.id || photo.rating === null) && photo.rating === null && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Summary */}
                  <p className="text-sm">{photo.result.summary}</p>

                  {/* Area scores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {photo.result.areas.map(area => (
                      <div key={area.areaId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span className="muted">{area.areaName}</span>
                        <span style={{ color: area.passed ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                          {Math.round(area.score)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Rating buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p className="text-xs muted" style={{ fontWeight: 600 }}>El resultado es correcto?</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => {
                          onRate(photo.id, 'ok');
                          setExpandedId(null);
                        }}
                        className="btn btn--primary"
                        style={{ flex: 1, minHeight: '44px', background: 'var(--accent-green)', borderColor: 'var(--accent-green)', fontSize: '0.8rem' }}
                      >
                        SI, ESTA BIEN
                      </button>
                      <button
                        onClick={() => setExpandedId(photo.id)}
                        className="btn btn--primary"
                        style={{ flex: 1, minHeight: '44px', background: 'var(--accent-red)', borderColor: 'var(--accent-red)', fontSize: '0.8rem' }}
                      >
                        NO, HAY PROBLEMAS
                      </button>
                    </div>

                    {/* Feedback for NO */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label htmlFor={`feedback-${photo.id}`} style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                        Que esperabas diferente?
                      </label>
                      <input
                        id={`feedback-${photo.id}`}
                        type="text"
                        value={feedbackMap[photo.id] ?? ''}
                        onChange={e => setFeedbackMap(prev => ({ ...prev, [photo.id]: e.target.value }))}
                        placeholder="Que esperabas diferente?"
                        className="gate-input"
                        style={{ minHeight: '44px' }}
                      />
                      <button
                        onClick={() => {
                          onRate(photo.id, 'no', feedbackMap[photo.id] ?? '');
                          setExpandedId(null);
                        }}
                        disabled={!feedbackMap[photo.id]?.trim()}
                        className="btn btn--primary"
                        style={{ width: '100%', minHeight: '44px', background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                      >
                        CONFIRMAR PROBLEMA
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Bottom actions */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
          {canDeploy && (
            <button
              onClick={onDeploy}
              className="btn btn--primary"
              style={{ width: '100%', minHeight: '44px' }}
            >
              DESPLEGAR CONFIGURACION
            </button>
          )}
          {canAdjust && iterationCount < 5 && (
            <button
              onClick={onAdjust}
              className="btn btn--primary"
              style={{ width: '100%', minHeight: '44px', background: 'var(--accent-yellow)', borderColor: 'var(--accent-yellow)', color: 'var(--text)' }}
            >
              AJUSTAR CONFIGURACION
            </button>
          )}
          {canAdjust && iterationCount >= 5 && (
            <div className="truncation-banner" style={{ textAlign: 'center', background: '#fee2e2', borderColor: 'var(--accent-red)' }}>
              <p style={{ fontSize: '0.875rem' }}>
                Alcanzaste el limite de iteraciones. Contacta soporte para continuar.
              </p>
            </div>
          )}
          {!allRated && allDone && (
            <p className="text-sm muted" style={{ textAlign: 'center' }}>
              Califica todos los resultados para continuar
            </p>
          )}
          {!allDone && photos.length > 0 && (
            <p className="text-sm muted" style={{ textAlign: 'center' }}>
              Esperando analisis...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Deploying view ───────────────────────────────────────────────────────────

function DeployingView() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      paddingTop: '4rem',
      paddingBottom: '4rem',
      textAlign: 'center',
    }}>
      <div
        role="status"
        aria-label="Desplegando configuracion"
        className="spinner"
        style={{ width: '40px', height: '40px', borderWidth: '4px' }}
      />
      <div>
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Desplegando tu configuracion...</p>
        <p className="text-sm muted">Esto tomara unos segundos</p>
      </div>
    </div>
  );
}

// ─── Approved view ───────────────────────────────────────────────────────────

interface ApprovedViewProps {
  config: ClientConfig;
}

function ApprovedView({ config }: ApprovedViewProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '1.5rem',
      paddingTop: '3rem',
      paddingBottom: '3rem',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: '3px solid var(--accent-green)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg
          style={{ width: '28px', height: '28px', color: 'var(--accent-green)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Configuracion aprobada</h2>
        <p className="muted">
          El perfil de <span style={{ fontWeight: 600, color: 'var(--text)' }}>{config.clientName}</span> ha sido guardado.
        </p>
      </div>
      <div className="card" style={{ textAlign: 'left', width: '100%', maxWidth: '360px' }}>
        <p className="text-sm" style={{ marginBottom: '0.35rem' }}>
          <span className="muted">Industria: </span>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{config.industry.replace('_', ' ')}</span>
        </p>
        <p className="text-sm" style={{ marginBottom: '0.35rem' }}>
          <span className="muted">Areas de evaluacion: </span>
          <span style={{ fontWeight: 600 }}>{config.evaluationAreas.length}</span>
        </p>
        <p className="text-sm">
          <span className="muted">Metodo de puntuacion: </span>
          <span style={{ fontWeight: 600 }}>{SCORING_LABELS[config.globalScoringMethod]}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        background: '#fee2e2',
        border: '2px solid var(--accent-red)',
        padding: '1rem',
        marginBottom: '1rem',
      }}
    >
      <span style={{ flexShrink: 0, color: 'var(--accent-red)', fontWeight: 700 }} aria-hidden="true">!</span>
      <p style={{ flex: 1, fontSize: '0.875rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font)',
              fontSize: '0.8rem',
              color: 'var(--accent-red)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Reintentar
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Cerrar error"
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font)',
            fontSize: '0.875rem',
            color: 'var(--accent-red)',
            cursor: 'pointer',
            fontWeight: 700,
            padding: 0,
          }}
        >
          X
        </button>
      </div>
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

  const handleStart = () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!code || !uuidRegex.test(code)) {
      return;
    }
    startSession(code);
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

  return (
    <div style={{ position: 'relative' }}>
      {/* Error banner */}
      {state.error && (
        <ErrorBanner
          message={state.error}
          onDismiss={resetError}
          onRetry={state.phase === 'chatting' ? undefined : undefined}
        />
      )}

      {state.phase === 'idle' && (
        <IdleView onStart={handleStart} loading={state.loading} />
      )}

      {state.phase === 'chatting' && !state.voiceMode && (
        <ChatView
          messages={state.messages}
          loading={state.loading}
          isComplete={state.isComplete}
          onSend={sendMessage}
          onStartSynthesis={startSynthesis}
          onStartVoice={handleStartVoice}
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

      {state.phase === 'reviewing' && state.synthesizedConfig && (
        <ReviewingView
          config={state.synthesizedConfig}
          gaps={state.gaps}
          confidence={state.confidence}
          onApprove={startTesting}
          onModify={requestModification}
        />
      )}

      {state.phase === 'testing' && (
        <TestingView
          photos={state.testPhotos}
          iterationCount={state.iterationCount}
          onAddPhoto={addTestPhoto}
          onRate={rateTestResult}
          onDeploy={deployConfig}
          onAdjust={requestAdjustment}
        />
      )}

      {state.phase === 'deploying' && <DeployingView />}

      {state.phase === 'approved' && state.synthesizedConfig && (
        <ApprovedView config={state.synthesizedConfig} />
      )}
    </div>
  );
}

// ─── Page (with Suspense boundary for useSearchParams) ────────────────────────

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem' }}>
          <div
            role="status"
            aria-label="Cargando"
            className="spinner"
            style={{ width: '32px', height: '32px', borderWidth: '4px' }}
          />
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}
