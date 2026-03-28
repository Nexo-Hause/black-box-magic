'use client';

import { useReducer, useCallback, useRef } from 'react';
import type { ClientConfig } from '@/types/engine';

// ─── State ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface OnboardingState {
  phase: 'idle' | 'chatting' | 'synthesizing' | 'reviewing' | 'approved';
  sessionId: string | null;
  token: string | null;
  clientName: string | null;
  messages: ChatMessage[];
  partialConfig: Record<string, unknown> | null;
  synthesizedConfig: ClientConfig | null;
  gaps: string[];
  confidence: number;
  turnCount: number;
  isComplete: boolean;
  error: string | null;
  loading: boolean;
  synthesisProgress: string;
}

const initialState: OnboardingState = {
  phase: 'idle',
  sessionId: null,
  token: null,
  clientName: null,
  messages: [],
  partialConfig: null,
  synthesizedConfig: null,
  gaps: [],
  confidence: 0,
  turnCount: 0,
  isComplete: false,
  error: null,
  loading: false,
  synthesisProgress: '',
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START_SESSION' }
  | { type: 'SESSION_CREATED'; sessionId: string; token: string; clientName: string }
  | { type: 'SEND_MESSAGE'; text: string }
  | { type: 'MESSAGE_SENT' }
  | { type: 'CHAT_RESPONSE'; response: string; isComplete: boolean; turnCount: number }
  | { type: 'CHAT_ERROR'; error: string }
  | { type: 'START_SYNTHESIS' }
  | { type: 'SYNTHESIS_PROGRESS'; progress: string }
  | { type: 'SYNTHESIS_SUCCESS'; config: ClientConfig; gaps: string[]; confidence: number }
  | { type: 'SYNTHESIS_ERROR'; error: string }
  | { type: 'APPROVE_CONFIG' }
  | { type: 'REQUEST_MODIFICATION' }
  | { type: 'RESET_ERROR' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'START_SESSION':
      return { ...state, loading: true, error: null };

    case 'SESSION_CREATED':
      return {
        ...state,
        loading: false,
        phase: 'chatting',
        sessionId: action.sessionId,
        token: action.token,
        clientName: action.clientName,
      };

    case 'SEND_MESSAGE':
      return {
        ...state,
        loading: true,
        error: null,
        messages: [
          ...state.messages,
          { role: 'user', content: action.text, timestamp: Date.now() },
        ],
      };

    case 'MESSAGE_SENT':
      return { ...state };

    case 'CHAT_RESPONSE':
      return {
        ...state,
        loading: false,
        isComplete: action.isComplete,
        turnCount: action.turnCount,
        messages: [
          ...state.messages,
          { role: 'assistant', content: action.response, timestamp: Date.now() },
        ],
      };

    case 'CHAT_ERROR':
      return { ...state, loading: false, error: action.error };

    case 'START_SYNTHESIS':
      return {
        ...state,
        phase: 'synthesizing',
        loading: true,
        error: null,
        synthesisProgress: 'Analizando tu conversación...',
      };

    case 'SYNTHESIS_PROGRESS':
      return { ...state, synthesisProgress: action.progress };

    case 'SYNTHESIS_SUCCESS':
      return {
        ...state,
        loading: false,
        phase: 'reviewing',
        synthesizedConfig: action.config,
        gaps: action.gaps,
        confidence: action.confidence,
        synthesisProgress: '',
      };

    case 'SYNTHESIS_ERROR':
      return {
        ...state,
        loading: false,
        phase: 'chatting',
        error: action.error,
        synthesisProgress: '',
      };

    case 'APPROVE_CONFIG':
      return { ...state, phase: 'approved' };

    case 'REQUEST_MODIFICATION':
      return {
        ...state,
        phase: 'chatting',
        isComplete: false,
        synthesizedConfig: null,
        gaps: [],
        confidence: 0,
      };

    case 'RESET_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingChat() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startSession = useCallback(async (code: string) => {
    dispatch({ type: 'START_SESSION' });
    try {
      const res = await fetch('/api/onboarding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
      dispatch({
        type: 'SESSION_CREATED',
        sessionId: data.sessionId,
        token: data.token,
        clientName: data.clientName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      dispatch({ type: 'CHAT_ERROR', error: message });
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!state.sessionId || !state.token) return;
    dispatch({ type: 'SEND_MESSAGE', text });
    try {
      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ sessionId: state.sessionId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar mensaje');
      dispatch({
        type: 'CHAT_RESPONSE',
        response: data.response,
        isComplete: data.isComplete,
        turnCount: data.turnCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar mensaje';
      dispatch({ type: 'CHAT_ERROR', error: message });
    }
  }, [state.sessionId, state.token]);

  const startSynthesis = useCallback(async () => {
    if (!state.sessionId || !state.token) return;
    dispatch({ type: 'START_SYNTHESIS' });

    const milestones: Array<{ delay: number; text: string }> = [
      { delay: 30_000, text: 'Generando áreas de evaluación...' },
      { delay: 60_000, text: 'Validando configuración...' },
      { delay: 90_000, text: 'Casi listo...' },
    ];

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Walk milestones in reverse to find the last one triggered
      for (let i = milestones.length - 1; i >= 0; i--) {
        if (elapsed >= milestones[i].delay) {
          dispatch({ type: 'SYNTHESIS_PROGRESS', progress: milestones[i].text });
          break;
        }
      }
    }, 5_000);

    try {
      const res = await fetch('/api/onboarding/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();
      clearProgressTimer();
      if (!res.ok) throw new Error(data.error || 'Error al generar configuración');
      dispatch({
        type: 'SYNTHESIS_SUCCESS',
        config: data.config as ClientConfig,
        gaps: data.gaps ?? [],
        confidence: data.confidence ?? 0,
      });
    } catch (err) {
      clearProgressTimer();
      const message = err instanceof Error ? err.message : 'Error al generar configuración';
      dispatch({ type: 'SYNTHESIS_ERROR', error: message });
    }
  }, [state.sessionId, state.token]);

  const approveConfig = useCallback(() => {
    dispatch({ type: 'APPROVE_CONFIG' });
  }, []);

  const requestModification = useCallback(() => {
    dispatch({ type: 'REQUEST_MODIFICATION' });
  }, []);

  const resetError = useCallback(() => {
    dispatch({ type: 'RESET_ERROR' });
  }, []);

  return {
    state,
    startSession,
    sendMessage,
    startSynthesis,
    approveConfig,
    requestModification,
    resetError,
  };
}
