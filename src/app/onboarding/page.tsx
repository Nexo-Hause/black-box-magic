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
    <div className="flex items-center gap-1 px-4 py-3 bg-gray-800 rounded-2xl rounded-tl-sm w-fit">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? 'bg-green-900 text-green-300' :
    pct >= 60 ? 'bg-yellow-900 text-yellow-300' :
                'bg-red-900 text-red-300';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {pct}% confianza
    </span>
  );
}

// ─── Evaluation area card ─────────────────────────────────────────────────────

function AreaCard({ area }: { area: EvaluationArea }) {
  const weightPct = Math.round(area.weight * 100);
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{area.name}</h3>
          {area.description && (
            <p className="text-sm text-gray-400 mt-0.5">{area.description}</p>
          )}
        </div>
        <span className="shrink-0 bg-blue-900 text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full">
          {weightPct}%
        </span>
      </div>
      {area.criteria.length > 0 && (
        <ul className="space-y-1.5">
          {area.criteria.map(c => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-mono ${
                c.type === 'binary'   ? 'bg-purple-900/60 text-purple-300' :
                c.type === 'scale'    ? 'bg-cyan-900/60 text-cyan-300' :
                c.type === 'count'    ? 'bg-orange-900/60 text-orange-300' :
                                        'bg-gray-700 text-gray-300'
              }`}>
                {c.type}
              </span>
              <span className="text-gray-300">
                {c.name}
                {c.critical && (
                  <span className="ml-1.5 text-red-400 text-xs font-medium">crítico</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Escalation rule item ─────────────────────────────────────────────────────

function EscalationRuleItem({ rule }: { rule: EscalationRule }) {
  const severityColor =
    rule.severity === 'critical' ? 'text-red-400' :
    rule.severity === 'high'     ? 'text-orange-400' :
    rule.severity === 'medium'   ? 'text-yellow-400' :
                                   'text-gray-400';
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`shrink-0 font-medium capitalize ${severityColor}`}>
        {rule.severity}
      </span>
      <span className="text-gray-400">—</span>
      <span className="text-gray-300">{rule.description}</span>
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
    <div className="flex flex-col items-center text-center gap-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">BLACK BOX MAGIC</h1>
        <p className="text-gray-400 mt-1 text-sm uppercase tracking-widest">Onboarding</p>
      </div>
      <p className="text-gray-300 max-w-md leading-relaxed">
        Vamos a configurar el análisis visual para tu operación. Te haré algunas preguntas
        para entender qué es lo más importante en tu negocio.
      </p>
      <button
        onClick={onStart}
        disabled={loading}
        className="min-h-[44px] px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                   disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors"
      >
        {loading ? 'Cargando...' : 'Comenzar'}
      </button>
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
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversación de onboarding"
        className="flex-1 overflow-y-auto py-4 space-y-4 pb-2"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Complete banner */}
      {isComplete && !loading && (
        <div className="bg-green-900/40 border border-green-700/50 rounded-xl p-4 mb-3 flex
                        flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-green-300 text-sm flex-1">
            Tengo suficiente información para generar tu configuración.
          </p>
          <button
            onClick={onStartSynthesis}
            className="min-h-[44px] shrink-0 px-5 py-2 bg-green-600 hover:bg-green-500
                       rounded-lg font-semibold text-white text-sm transition-colors"
          >
            Generar configuración
          </button>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2 pb-safe">
        <label htmlFor="chat-input" className="sr-only">Escribe tu respuesta</label>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe tu respuesta..."
          disabled={loading}
          autoComplete="off"
          className="flex-1 min-h-[44px] px-4 py-2 bg-gray-800 border border-gray-700
                     rounded-xl text-white placeholder-gray-500 text-sm
                     focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar mensaje"
          className="min-h-[44px] min-w-[44px] px-4 bg-blue-600 hover:bg-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     rounded-xl font-semibold text-white text-sm transition-colors"
        >
          →
        </button>
        {/* Mic button — progressive enhancement */}
        <button
          type="button"
          onClick={onStartVoice}
          disabled={loading}
          aria-label="Cambiar a modo de voz"
          title="Hablar con el asistente"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center
                     bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
                     rounded-xl text-gray-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
  systemPrompt: string;
  tools: unknown;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onComplete: () => void;
  onSwitchToText: () => void;
}

function VoiceView({ wsUrl, token, systemPrompt, tools, onTranscript, onComplete, onSwitchToText }: VoiceViewProps) {
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const [transcriptLines, setTranscriptLines] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

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
      setTranscriptLines(prev => [...prev, { role: 'assistant', text: `⚠ ${err}` }]);
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
    connected:   'Presiona el micrófono para hablar',
    listening:   'Escuchando...',
    processing:  'Procesando tu respuesta...',
    speaking:    'Respondiendo...',
    error:       'Error de conexión',
    closed:      'Sesión cerrada',
  };

  const isListening  = status === 'listening';
  const isSpeaking   = status === 'speaking';
  const isProcessing = status === 'processing';
  const isConnecting = status === 'connecting';
  const isError      = status === 'error' || status === 'closed';
  const canListen    = status === 'connected' || status === 'listening';

  // Audio level bar: convert 0–1 amplitude to percentage width
  const levelPct = Math.min(100, Math.round(audioLevel * 600));

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else if (canListen) {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)]">
      {/* Status announcement for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {STATUS_LABEL[status]}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnecting                  ? 'bg-yellow-400 animate-pulse' :
            isError                       ? 'bg-red-400' :
            isSpeaking || isProcessing    ? 'bg-blue-400 animate-pulse' :
            isListening                   ? 'bg-green-400 animate-pulse' :
                                            'bg-green-400'
          }`} aria-hidden="true" />
          <span className="text-sm text-gray-400">{STATUS_LABEL[status]}</span>
        </div>
        <button
          onClick={onSwitchToText}
          className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
        >
          Cambiar a texto
        </button>
      </div>

      {/* Transcript */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Transcripción de la conversación de voz"
        className="flex-1 overflow-y-auto space-y-3 pb-4"
      >
        {transcriptLines.length === 0 && !isConnecting && (
          <p className="text-center text-gray-600 text-sm pt-8">
            La conversación aparecerá aquí
          </p>
        )}
        {transcriptLines.map((line, i) => (
          <div key={i} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              line.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-100 rounded-tl-sm'
            }`}>
              {line.text}
            </div>
          </div>
        ))}
        <div ref={transcriptBottomRef} />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 pb-safe pt-4">
        {/* Audio level bar */}
        {isListening && (
          <div
            aria-hidden="true"
            className="w-full max-w-xs h-1.5 bg-gray-700 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-75"
              style={{ width: `${levelPct}%` }}
            />
          </div>
        )}

        {/* Mic button */}
        {!isError && (
          <button
            onClick={handleMicPress}
            disabled={!canListen || isConnecting}
            aria-label={isListening ? 'Detener grabación' : 'Iniciar grabación'}
            aria-pressed={isListening}
            className={`
              relative flex items-center justify-center
              w-20 h-20 rounded-full text-white transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500
              ${isListening
                ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_0_0_rgba(74,222,128,0.4)] animate-pulse-ring'
                : 'bg-gray-700 hover:bg-gray-600 shadow-lg'
              }
            `}
          >
            {/* Pulse ring animation when listening */}
            {isListening && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-green-500 opacity-30 animate-ping"
              />
            )}

            {/* Icon */}
            {isSpeaking ? (
              // Speaker icon
              <svg className="w-8 h-8 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 0 1 0 7.072M18.364 5.636a9 9 0 0 1 0 12.728M11 5L6 9H3v6h3l5 4V5z" />
              </svg>
            ) : isProcessing ? (
              // Spinner
              <div
                className="w-8 h-8 border-4 border-gray-500 border-t-white rounded-full animate-spin relative z-10"
                aria-hidden="true"
              />
            ) : (
              // Microphone icon
              <svg className="w-8 h-8 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-red-400 text-sm">{STATUS_LABEL[status]}</p>
            <button
              onClick={onSwitchToText}
              className="min-h-[44px] px-6 py-2 bg-gray-700 hover:bg-gray-600
                         rounded-xl font-semibold text-white text-sm transition-colors"
            >
              Continuar por texto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SynthesizingViewProps {
  progress: string;
}

function SynthesizingView({ progress }: SynthesizingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      {/* Spinner */}
      <div
        role="status"
        aria-label="Generando configuración"
        className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin"
      />
      <div className="space-y-2">
        <p className="text-white font-medium">{progress || 'Analizando tu conversación...'}</p>
        <p className="text-gray-500 text-sm">Este paso toma aproximadamente 2 minutos</p>
      </div>
    </div>
  );
}

interface ReviewingViewProps {
  config: ClientConfig;
  gaps: string[];
  confidence: number;
  onApprove: () => void;
  onModify: () => void;
}

function ReviewingView({ config, gaps, confidence, onApprove, onModify }: ReviewingViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white">Tu configuración</h2>
            <p className="text-gray-400 text-sm mt-0.5">{config.clientName}</p>
          </div>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <p className="text-sm text-gray-400">
          Método de puntuación:{' '}
          <span className="text-gray-200 font-medium">
            {SCORING_LABELS[config.globalScoringMethod]}
          </span>
          {config.passingScore !== undefined && (
            <> · Aprobación desde <span className="text-gray-200 font-medium">{config.passingScore}%</span></>
          )}
        </p>
      </div>

      {/* Evaluation areas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Áreas de evaluación
        </h3>
        {config.evaluationAreas.map(area => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>

      {/* Escalation rules */}
      {config.escalationRules.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Reglas de escalación
          </h3>
          <ul className="space-y-2 bg-gray-800/50 rounded-xl p-4">
            {config.escalationRules.map(rule => (
              <EscalationRuleItem key={rule.id} rule={rule} />
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-yellow-300">Información pendiente</h3>
          <ul className="space-y-1">
            {gaps.map((gap, i) => (
              <li key={i} className="text-sm text-yellow-200/80 flex items-start gap-2">
                <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onApprove}
          className="flex-1 min-h-[44px] py-3 bg-green-600 hover:bg-green-500
                     rounded-xl font-semibold text-white transition-colors"
        >
          Aprobar y probar
        </button>
        <button
          onClick={onModify}
          className="flex-1 min-h-[44px] py-3 bg-gray-700 hover:bg-gray-600
                     rounded-xl font-semibold text-gray-100 transition-colors"
        >
          Modificar
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Prueba tu configuración</h2>
        <p className="text-gray-400 text-sm mt-1">
          Sube 5-10 fotos de tus visitas de campo para verificar que el análisis funciona correctamente.
        </p>
        {iterationCount > 0 && (
          <p className="text-yellow-400 text-xs mt-1 font-medium">
            Iteración {iterationCount} de 5
          </p>
        )}
      </div>

      {/* Upload area */}
      {photos.length < MAX_PHOTOS && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${dragActive
              ? 'border-blue-400 bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/40'
            }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V18" />
            </svg>
            <p className="text-gray-300 text-sm font-medium">
              {dragActive ? 'Suelta las fotos aquí' : 'Arrastra fotos o haz clic para seleccionar'}
            </p>
            <p className="text-gray-500 text-xs">JPEG, PNG o WebP · máx. 10 MB · {photos.length}/{MAX_PHOTOS} fotos</p>
          </div>
        </div>
      )}

      {/* Photo list */}
      {photos.length > 0 && (
        <ul className="space-y-3">
          {photos.map(photo => (
            <li key={photo.id} className="bg-gray-800 rounded-xl overflow-hidden">
              {/* Photo row */}
              <div className="flex items-center gap-3 p-3">
                {/* Thumbnail */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{photo.fileName}</p>
                  {photo.status === 'done' && photo.result && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Puntaje: <span className={photo.result.passed ? 'text-green-400' : 'text-red-400'}>
                        {Math.round(photo.result.globalScore)}%
                      </span>
                      {' · '}
                      <span className={photo.result.passed ? 'text-green-400' : 'text-red-400'}>
                        {photo.result.passed ? 'Aprobado' : 'Reprobado'}
                      </span>
                    </p>
                  )}
                  {photo.status === 'error' && (
                    <p className="text-xs text-red-400 mt-0.5">Error al analizar</p>
                  )}
                  {photo.status === 'analyzing' && (
                    <p className="text-xs text-blue-400 mt-0.5">Analizando...</p>
                  )}
                  {photo.status === 'pending' && (
                    <p className="text-xs text-gray-500 mt-0.5">En cola</p>
                  )}
                </div>

                {/* Status indicator */}
                <div className="shrink-0">
                  {photo.status === 'analyzing' && (
                    <div
                      role="status"
                      aria-label="Analizando"
                      className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"
                    />
                  )}
                  {photo.status === 'done' && photo.rating === null && (
                    <button
                      onClick={() => setExpandedId(prev => prev === photo.id ? null : photo.id)}
                      aria-label="Ver resultado"
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={expandedId === photo.id ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                      </svg>
                    </button>
                  )}
                  {photo.status === 'done' && photo.rating === 'ok' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/60 text-green-300">OK</span>
                  )}
                  {photo.status === 'done' && photo.rating === 'no' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-900/60 text-red-300">NO</span>
                  )}
                </div>
              </div>

              {/* Expanded result + rating */}
              {photo.status === 'done' && photo.result && (expandedId === photo.id || photo.rating === null) && photo.rating === null && (
                <div className="border-t border-gray-700 p-3 space-y-3">
                  {/* Summary */}
                  <p className="text-sm text-gray-300">{photo.result.summary}</p>

                  {/* Area scores */}
                  <div className="space-y-1.5">
                    {photo.result.areas.map(area => (
                      <div key={area.areaId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{area.areaName}</span>
                        <span className={area.passed ? 'text-green-400' : 'text-red-400'}>
                          {Math.round(area.score)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Rating buttons */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">¿El resultado es correcto?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onRate(photo.id, 'ok');
                          setExpandedId(null);
                        }}
                        className="flex-1 min-h-[44px] py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold text-white transition-colors"
                      >
                        Sí, está bien
                      </button>
                      <button
                        onClick={() => setExpandedId(photo.id)}
                        className="flex-1 min-h-[44px] py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-colors"
                      >
                        No, hay problemas
                      </button>
                    </div>

                    {/* Feedback for NO */}
                    <div className="space-y-2">
                      <label htmlFor={`feedback-${photo.id}`} className="sr-only">
                        ¿Qué esperabas diferente?
                      </label>
                      <input
                        id={`feedback-${photo.id}`}
                        type="text"
                        value={feedbackMap[photo.id] ?? ''}
                        onChange={e => setFeedbackMap(prev => ({ ...prev, [photo.id]: e.target.value }))}
                        placeholder="¿Qué esperabas diferente?"
                        className="w-full min-h-[44px] px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                      />
                      <button
                        onClick={() => {
                          onRate(photo.id, 'no', feedbackMap[photo.id] ?? '');
                          setExpandedId(null);
                        }}
                        disabled={!feedbackMap[photo.id]?.trim()}
                        className="w-full min-h-[44px] py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors"
                      >
                        Confirmar problema
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
        <div className="flex flex-col gap-3 pt-2">
          {canDeploy && (
            <button
              onClick={onDeploy}
              className="w-full min-h-[44px] py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-white transition-colors"
            >
              Desplegar configuración
            </button>
          )}
          {canAdjust && iterationCount < 5 && (
            <button
              onClick={onAdjust}
              className="w-full min-h-[44px] py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-semibold text-white transition-colors"
            >
              Ajustar configuración
            </button>
          )}
          {canAdjust && iterationCount >= 5 && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 text-center">
              <p className="text-red-300 text-sm">
                Alcanzaste el límite de iteraciones. Contacta soporte para continuar.
              </p>
            </div>
          )}
          {!allRated && allDone && (
            <p className="text-center text-sm text-gray-500">
              Califica todos los resultados para continuar
            </p>
          )}
          {!allDone && photos.length > 0 && (
            <p className="text-center text-sm text-gray-500">
              Esperando análisis...
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
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div
        role="status"
        aria-label="Desplegando configuración"
        className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin"
      />
      <div className="space-y-2">
        <p className="text-white font-medium">Desplegando tu configuración...</p>
        <p className="text-gray-500 text-sm">Esto tomará unos segundos</p>
      </div>
    </div>
  );
}

interface ApprovedViewProps {
  config: ClientConfig;
}

function ApprovedView({ config }: ApprovedViewProps) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-12">
      <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Configuración aprobada</h2>
        <p className="text-gray-400">
          El perfil de <span className="text-white font-medium">{config.clientName}</span> ha sido guardado.
        </p>
      </div>
      <div className="bg-gray-800 rounded-xl p-4 text-left w-full max-w-sm space-y-2 text-sm">
        <p className="text-gray-400">
          Industria:{' '}
          <span className="text-gray-200 capitalize">{config.industry.replace('_', ' ')}</span>
        </p>
        <p className="text-gray-400">
          Áreas de evaluación:{' '}
          <span className="text-gray-200">{config.evaluationAreas.length}</span>
        </p>
        <p className="text-gray-400">
          Método de puntuación:{' '}
          <span className="text-gray-200">{SCORING_LABELS[config.globalScoringMethod]}</span>
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
      className="flex items-start gap-3 bg-red-900/40 border border-red-700/50 rounded-xl p-4 mb-4"
    >
      <span className="shrink-0 text-red-400 mt-0.5" aria-hidden="true">✕</span>
      <p className="flex-1 text-red-300 text-sm">{message}</p>
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-red-300 hover:text-white text-sm underline underline-offset-2"
          >
            Reintentar
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Cerrar error"
          className="text-red-400 hover:text-white text-sm"
        >
          ✕
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
      return; // Invalid code — button should be disabled without valid code
    }
    startSession(code);
  };

  const handleStartVoice = () => {
    startVoiceSession();
  };

  const handleSwitchToText = () => {
    endVoiceSession();
  };

  // When a voice transcript arrives, inject it into the text message history
  const handleVoiceTranscript = useCallback(
    (text: string, role: 'user' | 'assistant') => {
      if (role === 'user') {
        // User speech — dispatch as a chat message so the server is notified
        sendMessage(text);
      }
      // Assistant transcripts are already captured in VoiceView's local state
    },
    [sendMessage],
  );

  return (
    <div className="relative">
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
        <div className="flex items-center justify-center py-16">
          <div
            role="status"
            aria-label="Cargando"
            className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin"
          />
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}
