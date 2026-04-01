'use client';

import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { ClientConfig, EngineV3Result } from '@/types/engine';

// ─── State ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TestPhoto {
  id: string;
  fileName: string;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result: EngineV3Result | null;
  rating: 'ok' | 'no' | null;
  feedback: string;
}

interface VoiceSession {
  wsUrl: string;
  token: string;
  expiresAt: string;
  systemPrompt: string;
  tools: unknown;
}

interface OnboardingState {
  phase: 'idle' | 'chatting' | 'synthesizing' | 'reviewing' | 'testing' | 'deploying' | 'approved';
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
  testPhotos: TestPhoto[];
  iterationCount: number;
  voiceSession: VoiceSession | null;
  voiceMode: boolean;
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
  testPhotos: [],
  iterationCount: 0,
  voiceSession: null,
  voiceMode: false,
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
  | { type: 'RESET_ERROR' }
  | { type: 'START_TESTING' }
  | { type: 'ADD_TEST_PHOTO'; photo: TestPhoto }
  | { type: 'TEST_PHOTO_ANALYZING'; photoId: string }
  | { type: 'TEST_PHOTO_RESULT'; photoId: string; result: EngineV3Result }
  | { type: 'TEST_PHOTO_ERROR'; photoId: string; error: string }
  | { type: 'RATE_TEST_RESULT'; photoId: string; rating: 'ok' | 'no'; feedback: string }
  | { type: 'START_DEPLOY' }
  | { type: 'DEPLOY_SUCCESS' }
  | { type: 'DEPLOY_ERROR'; error: string }
  | { type: 'REQUEST_ADJUSTMENT' }
  | { type: 'VOICE_SESSION_STARTED'; session: VoiceSession }
  | { type: 'VOICE_MODE_TOGGLE' }
  | { type: 'VOICE_SESSION_ENDED' };

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

    case 'START_TESTING':
      return { ...state, phase: 'testing', testPhotos: [], error: null };

    case 'ADD_TEST_PHOTO':
      if (state.testPhotos.length >= 10) return state;
      return { ...state, testPhotos: [...state.testPhotos, action.photo] };

    case 'TEST_PHOTO_ANALYZING':
      return {
        ...state,
        testPhotos: state.testPhotos.map(p =>
          p.id === action.photoId ? { ...p, status: 'analyzing' } : p
        ),
      };

    case 'TEST_PHOTO_RESULT':
      return {
        ...state,
        testPhotos: state.testPhotos.map(p =>
          p.id === action.photoId ? { ...p, status: 'done', result: action.result } : p
        ),
      };

    case 'TEST_PHOTO_ERROR':
      return {
        ...state,
        testPhotos: state.testPhotos.map(p =>
          p.id === action.photoId ? { ...p, status: 'error' } : p
        ),
      };

    case 'RATE_TEST_RESULT':
      return {
        ...state,
        testPhotos: state.testPhotos.map(p =>
          p.id === action.photoId ? { ...p, rating: action.rating, feedback: action.feedback } : p
        ),
      };

    case 'START_DEPLOY':
      return { ...state, phase: 'deploying', loading: true, error: null };

    case 'DEPLOY_SUCCESS':
      return { ...state, phase: 'approved', loading: false };

    case 'DEPLOY_ERROR':
      return { ...state, phase: 'testing', loading: false, error: action.error };

    case 'REQUEST_ADJUSTMENT':
      return {
        ...state,
        phase: 'chatting',
        isComplete: false,
        synthesizedConfig: null,
        gaps: [],
        confidence: 0,
        iterationCount: state.iterationCount + 1,
        testPhotos: [],
      };

    case 'VOICE_SESSION_STARTED':
      return {
        ...state,
        voiceSession: action.session,
        voiceMode: true,
        error: null,
      };

    case 'VOICE_MODE_TOGGLE':
      return {
        ...state,
        voiceMode: !state.voiceMode,
      };

    case 'VOICE_SESSION_ENDED':
      return {
        ...state,
        voiceSession: null,
        voiceMode: false,
      };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingChat() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

      // Auto-send initial message so Gemini starts the conversation
      try {
        const chatRes = await fetch('/api/onboarding/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({
            sessionId: data.sessionId,
            message: 'Hola, estoy listo para configurar mi análisis visual.',
          }),
        });
        const chatData = await chatRes.json();
        if (chatRes.ok) {
          dispatch({
            type: 'CHAT_RESPONSE',
            response: chatData.response,
            isComplete: chatData.isComplete ?? false,
            turnCount: chatData.turnCount ?? 1,
          });
        } else {
          throw new Error(chatData.error || 'Auto-start failed');
        }
      } catch {
        // Auto-start failed — let user know they can type manually
        dispatch({
          type: 'CHAT_ERROR',
          error: 'No se pudo iniciar la conversación automáticamente. Escribe tu primer mensaje.',
        });
      }
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

  const startTesting = useCallback(() => {
    dispatch({ type: 'START_TESTING' });
  }, []);

  const addTestPhoto = useCallback(async (file: File) => {
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 10 * 1024 * 1024;

    if (!ACCEPTED.includes(file.type)) {
      dispatch({ type: 'CHAT_ERROR', error: 'Tipo de archivo no permitido. Usa JPEG, PNG o WebP.' });
      return;
    }
    if (file.size > MAX_SIZE) {
      dispatch({ type: 'CHAT_ERROR', error: 'El archivo supera el límite de 10 MB.' });
      return;
    }

    const photoId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);

    const photo: TestPhoto = {
      id: photoId,
      fileName: file.name,
      previewUrl,
      status: 'pending',
      result: null,
      rating: null,
      feedback: '',
    };
    dispatch({ type: 'ADD_TEST_PHOTO', photo });

    // Read as base64 then POST to /api/onboarding/test
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });

    dispatch({ type: 'TEST_PHOTO_ANALYZING', photoId });

    try {
      // Access current token via closure — we read it from a ref to stay stable
      const token = stateRef.current.token;
      const res = await fetch('/api/onboarding/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image: base64, mimeType: file.type, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      dispatch({ type: 'TEST_PHOTO_RESULT', photoId, result: data.result as EngineV3Result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al analizar foto';
      dispatch({ type: 'TEST_PHOTO_ERROR', photoId, error: message });
    }
  }, []);

  const rateTestResult = useCallback((photoId: string, rating: 'ok' | 'no', feedback = '') => {
    dispatch({ type: 'RATE_TEST_RESULT', photoId, rating, feedback });
  }, []);

  const deployConfig = useCallback(async () => {
    const { sessionId, token } = stateRef.current;
    if (!sessionId || !token) return;
    dispatch({ type: 'START_DEPLOY' });
    try {
      const res = await fetch('/api/onboarding/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      dispatch({ type: 'DEPLOY_SUCCESS' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al desplegar configuración';
      dispatch({ type: 'DEPLOY_ERROR', error: message });
    }
  }, []);

  const requestAdjustment = useCallback(() => {
    if (stateRef.current.iterationCount >= 5) return;
    dispatch({ type: 'REQUEST_ADJUSTMENT' });
  }, []);

  const startVoiceSession = useCallback(async () => {
    const { sessionId, token } = stateRef.current;
    if (!sessionId || !token) return;
    try {
      const res = await fetch('/api/onboarding/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión de voz');
      dispatch({
        type: 'VOICE_SESSION_STARTED',
        session: {
          wsUrl: data.wsUrl,
          token: data.token,
          expiresAt: data.expiresAt,
          systemPrompt: data.systemPrompt,
          tools: data.tools,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión de voz';
      dispatch({ type: 'CHAT_ERROR', error: message });
    }
  }, []);

  const toggleVoiceMode = useCallback(() => {
    dispatch({ type: 'VOICE_MODE_TOGGLE' });
  }, []);

  const endVoiceSession = useCallback(() => {
    dispatch({ type: 'VOICE_SESSION_ENDED' });
  }, []);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      stateRef.current.testPhotos.forEach(p => {
        if (p.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(p.previewUrl);
        }
      });
    };
  }, []); // Cleanup on unmount only — stateRef gives latest state

  return {
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
    toggleVoiceMode,
    endVoiceSession,
  };
}
