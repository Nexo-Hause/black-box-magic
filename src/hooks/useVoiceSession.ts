'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceStatus =
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'closed';

export interface UseVoiceSessionProps {
  wsUrl: string;
  token: string;
  systemPrompt: string;
  tools: unknown;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export interface UseVoiceSessionReturn {
  status: VoiceStatus;
  connect: () => void;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  audioLevel: number; // 0–1 normalized amplitude
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

/** Resample PCM Float32 buffer to 16 kHz mono Int16, return base64. */
function encodeAudioChunk(inputBuffer: Float32Array, inputSampleRate: number): string {
  const targetRate = 16_000;
  const ratio = inputSampleRate / targetRate;
  const outputLength = Math.floor(inputBuffer.length / ratio);
  const int16 = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, inputBuffer[srcIndex]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Compute RMS amplitude of a Float32Array, normalized 0–1. */
function computeLevel(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceSession({
  wsUrl,
  token: _token,
  systemPrompt,
  tools,
  onTranscript,
  onToolCall,
  onComplete,
  onError,
}: UseVoiceSessionProps): UseVoiceSessionReturn {
  const [status, setStatus] = useState<VoiceStatus>('connecting');
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs so callbacks never go stale
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);

  const onTranscriptRef = useRef(onTranscript);
  const onToolCallRef = useRef(onToolCall);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onToolCallRef.current = onToolCall; }, [onToolCall]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    listeningRef.current = false;
    scriptProcessorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    scriptProcessorRef.current = null;
    sourceRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setAudioLevel(0);
  }, []);

  const disconnect = useCallback(() => {
    stopAudio();
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent onclose from firing onError
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('closed');
  }, [stopAudio]);

  // ── Incoming WS message handler ──────────────────────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      return;
    }

    // Model content (text / function calls)
    const serverContent = msg['serverContent'] as Record<string, unknown> | undefined;
    if (serverContent) {
      const modelTurn = serverContent['modelTurn'] as Record<string, unknown> | undefined;
      if (modelTurn) {
        const parts = (modelTurn['parts'] as Array<Record<string, unknown>>) ?? [];
        for (const part of parts) {
          if (typeof part['text'] === 'string' && part['text']) {
            setTranscript(prev => prev + part['text']);
            onTranscriptRef.current(part['text'] as string, 'assistant');
          }
          const fc = part['functionCall'] as Record<string, unknown> | undefined;
          if (fc) {
            const name = fc['name'] as string;
            const args = (fc['args'] as Record<string, unknown>) ?? {};
            onToolCallRef.current(name, args);
          }
        }
        setStatus('speaking');
      }
      if (serverContent['turnComplete']) {
        setStatus(listeningRef.current ? 'listening' : 'connected');
        setTranscript('');
        onCompleteRef.current();
      }
      return;
    }

    // Top-level toolCall (batch style, some Gemini versions)
    const toolCall = msg['toolCall'] as Record<string, unknown> | undefined;
    if (toolCall) {
      const functionCalls = (toolCall['functionCalls'] as Array<Record<string, unknown>>) ?? [];
      for (const fc of functionCalls) {
        const name = fc['name'] as string;
        const args = (fc['args'] as Record<string, unknown>) ?? {};
        onToolCallRef.current(name, args);
      }
      // Send empty tool response to unblock the model
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          toolResponse: {
            functionResponses: functionCalls.map(fc => ({
              id: fc['id'],
              name: fc['name'],
              response: { result: 'ok' },
            })),
          },
        }));
      }
    }
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────

  const connectAttemptsRef = useRef(0);
  const MAX_CONNECT_ATTEMPTS = 3;

  const connect = useCallback(() => {
    if (wsRef.current) return; // already open

    if (connectAttemptsRef.current >= MAX_CONNECT_ATTEMPTS) {
      setStatus('error');
      onErrorRef.current('No se pudo conectar después de varios intentos. Usa el modo texto.');
      return;
    }
    connectAttemptsRef.current++;

    if (!wsUrl.includes('generativelanguage.googleapis.com')) {
      setStatus('error');
      onErrorRef.current('Invalid WebSocket endpoint');
      return;
    }

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial setup config
      ws.send(JSON.stringify({
        config: {
          model: 'models/gemini-3.1-flash-live-preview',
          responseModalities: ['AUDIO', 'TEXT'],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          tools: [tools],
        },
      }));
      connectAttemptsRef.current = 0; // Reset on success
      setStatus('connected');
    };

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      setStatus('error');
      onErrorRef.current('Error de conexión con el asistente de voz');
    };

    ws.onclose = (e) => {
      if (e.code !== 1000 && e.code !== 1001) {
        // Abnormal close
        setStatus('error');
        onErrorRef.current('La conexión de voz se cerró inesperadamente');
      } else {
        setStatus('closed');
      }
      stopAudio();
    };
  }, [wsUrl, systemPrompt, tools, handleMessage, stopAudio]);

  // ── Start listening ───────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (listeningRef.current) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      onErrorRef.current('La conexión de voz no está lista');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Activa el micrófono en la configuración del navegador.'
          : `No se pudo acceder al micrófono: ${err.message}`)
        : 'No se pudo acceder al micrófono';
      setStatus('error');
      onErrorRef.current(msg);
      return;
    }

    streamRef.current = stream;
    const ctx = new AudioContext({ sampleRate: 48_000 });
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // ScriptProcessorNode is deprecated but universally supported.
    // AudioWorklet would be preferred but requires a separate .js file.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    scriptProcessorRef.current = processor;

    const ws = wsRef.current;
    const inputSampleRate = ctx.sampleRate;

    processor.onaudioprocess = (e) => {
      if (!listeningRef.current) return;
      const inputData = e.inputBuffer.getChannelData(0);
      setAudioLevel(computeLevel(inputData));
      if (ws.readyState === WebSocket.OPEN) {
        const base64 = encodeAudioChunk(inputData, inputSampleRate);
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }],
          },
        }));
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination); // Required for onaudioprocess to fire

    listeningRef.current = true;
    setStatus('listening');
  }, []);

  // ── Stop listening ────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;

    // Signal end of turn
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ realtimeInput: { mediaChunks: [] } }));
    }

    // Delay audio cleanup to allow final frames to process
    setTimeout(() => {
      stopAudio();
      setStatus('processing');
    }, 150);
  }, [stopAudio]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopAudio();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [stopAudio]);

  return {
    status,
    connect,
    disconnect,
    startListening,
    stopListening,
    transcript,
    audioLevel,
  };
}
