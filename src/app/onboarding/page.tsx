'use client';

import { useEffect, useRef, useState, Suspense, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOnboardingChat } from '@/hooks/useOnboardingChat';
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
}

function ChatView({ messages, loading, isComplete, onSend, onStartSynthesis }: ChatViewProps) {
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

      {/* Input */}
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
      </form>
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
          Aprobar configuración
        </button>
        <button
          onClick={onModify}
          className="flex-1 min-h-[44px] py-3 bg-gray-700 hover:bg-gray-600
                     rounded-xl font-semibold text-gray-100 transition-colors"
        >
          Tengo algo que modificar
        </button>
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
  const { state, startSession, sendMessage, startSynthesis, approveConfig, requestModification, resetError } =
    useOnboardingChat();

  const handleStart = () => {
    if (code) {
      startSession(code);
    } else {
      startSession(''); // will fail with a clear error from API
    }
  };

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

      {state.phase === 'chatting' && (
        <ChatView
          messages={state.messages}
          loading={state.loading}
          isComplete={state.isComplete}
          onSend={sendMessage}
          onStartSynthesis={startSynthesis}
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
          onApprove={approveConfig}
          onModify={requestModification}
        />
      )}

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
