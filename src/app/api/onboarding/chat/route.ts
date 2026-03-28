import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import {
  getOnboardingToolDeclarations,
  processAllToolCalls,
  createEmptyPartialConfig,
  type PartialOnboardingConfig,
} from '@/lib/onboarding/tools';
import { ONBOARDING_SYSTEM_PROMPT } from '@/lib/onboarding/system-prompt';
import { callGeminiChatWithRetry, CHAT_MODEL, type ChatMessage } from '@/lib/gemini-chat';
import { chatRequestSchema } from '@/types/onboarding';
import { supabase } from '@/lib/supabase';

export const maxDuration = 30;

// ─── Anti-injection ───────────────────────────────────────────────────────────

const INJECTION_PATTERN =
  /ignore previous|override|forget|new role|system:|assistant:|user:/i;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TURNS = 40;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Validate Gemini key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service not available', status: 500 },
      { status: 500 }
    );
  }

  // Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status }
    );
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  // Validate with Zod schema
  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request: sessionId (UUID) and message (1–1000 chars) required', status: 400 },
      { status: 400 }
    );
  }

  const { sessionId, message } = parsed.data;

  // Anti-injection check
  if (INJECTION_PATTERN.test(message)) {
    return NextResponse.json(
      { error: 'El mensaje contiene patrones no permitidos', status: 400 },
      { status: 400 }
    );
  }

  // ─── Fetch session from Supabase ─────────────────────────────────────────
  let storedTranscript: ChatMessage[] = [];
  let storedPartialConfig: PartialOnboardingConfig = createEmptyPartialConfig();

  if (supabase) {
    try {
      const { data: sessionRow, error: fetchError } = await supabase
        .from('bbm_client_configs')
        .select('transcript, partial_config')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError) {
        console.error('[onboarding/chat] Error fetching session:', fetchError.message);
        // Graceful degradation: proceed with empty history
      } else if (sessionRow) {
        storedTranscript = (sessionRow.transcript as ChatMessage[]) ?? [];
        storedPartialConfig =
          (sessionRow.partial_config as PartialOnboardingConfig) ?? createEmptyPartialConfig();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/chat] Supabase error:', message);
      // Graceful degradation: proceed with empty history
    }
  }

  // ─── Build messages array ─────────────────────────────────────────────────
  const newUserMessage: ChatMessage = {
    role: 'user',
    parts: [{ text: message }],
  };

  // Truncate to last MAX_TURNS turns if needed (S5: keep context bounded)
  const allMessages: ChatMessage[] = [...storedTranscript, newUserMessage];
  const truncatedMessages =
    allMessages.length > MAX_TURNS
      ? allMessages.slice(allMessages.length - MAX_TURNS)
      : allMessages;

  // ─── First Gemini call ────────────────────────────────────────────────────
  let currentConfig = storedPartialConfig;
  const tools = getOnboardingToolDeclarations();

  let response = await callGeminiChatWithRetry(
    CHAT_MODEL,
    ONBOARDING_SYSTEM_PROMPT,
    truncatedMessages,
    apiKey,
    [tools]
  );

  // ─── Tool call loop ───────────────────────────────────────────────────────
  // Collect all tool calls across iterations for the response
  const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let workingMessages = [...truncatedMessages];

  while (response.functionCalls && response.functionCalls.length > 0) {
    const calls = response.functionCalls;
    allToolCalls.push(...calls);

    // Process tool calls against partial config
    try {
      currentConfig = processAllToolCalls(calls, currentConfig);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/chat] Tool processing error:', errMsg);
      // Continue — partial config may be incomplete but we don't block the user
    }

    // Append model turn with function calls to working messages
    const modelTurnParts = calls.map((call) => ({
      functionCall: { name: call.name, args: call.args },
    }));
    workingMessages = [
      ...workingMessages,
      { role: 'model' as const, parts: modelTurnParts },
      {
        role: 'user' as const,
        parts: calls.map((call) => ({
          functionResponse: {
            name: call.name,
            response: { result: 'ok' },
          },
        })),
      },
    ];

    // Second Gemini call with function responses
    response = await callGeminiChatWithRetry(
      CHAT_MODEL,
      ONBOARDING_SYSTEM_PROMPT,
      workingMessages,
      apiKey,
      [tools]
    );
  }

  // Final text response
  const responseText = response.text ?? '';

  // ─── Build updated transcript for storage ─────────────────────────────────
  // Append the new user message and the final model response
  const updatedTranscript: ChatMessage[] = [
    ...storedTranscript,
    newUserMessage,
    {
      role: 'model',
      parts: responseText ? [{ text: responseText }] : [{ text: '' }],
    },
  ];

  const turnCount = Math.floor(updatedTranscript.length / 2);

  // ─── Incremental save to Supabase (UX1) ──────────────────────────────────
  if (supabase) {
    try {
      const { error: updateError } = await supabase
        .from('bbm_client_configs')
        .update({
          transcript: updatedTranscript,
          partial_config: currentConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[onboarding/chat] Error saving transcript:', updateError.message);
        // Non-fatal — response is still returned to user
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[onboarding/chat] Supabase save error:', errMsg);
    }
  }

  // ─── Return response ──────────────────────────────────────────────────────
  return NextResponse.json({
    response: responseText,
    ...(allToolCalls.length > 0 && { toolCalls: allToolCalls }),
    isComplete: currentConfig.isComplete,
    turnCount,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing { sessionId, message }',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
