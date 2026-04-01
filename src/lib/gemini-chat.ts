/**
 * Black Box Magic — Text Chat Client
 *
 * Gemini text-only chat with function calling support.
 * Separate from gemini.ts which handles image analysis.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const CHAT_MODEL = 'gemini-2.5-flash';
export const SYNTHESIS_MODEL = 'gemini-2.5-pro';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export type ChatPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiTool {
  functionDeclarations: FunctionDeclaration[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatResponse {
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  tokens: { input: number; output: number; total: number };
}

// ─── Internal response shape ──────────────────────────────────────────────────

interface GeminiChatResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<
        | { text: string; functionCall?: never }
        | { functionCall: { name: string; args: Record<string, unknown> }; text?: never }
      >;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// ─── Core call ────────────────────────────────────────────────────────────────

export async function callGeminiChat(
  model: string,
  systemInstruction: string,
  messages: ChatMessage[],
  apiKey: string,
  tools?: GeminiTool[]
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: messages,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    const err = new Error(`Gemini Chat API error (${response.status}): ${errorBody}`);
    (err as Error & { status: number }).status = response.status;
    throw err;
  }

  const data: GeminiChatResponse = await response.json();

  const parts = data.candidates?.[0]?.content?.parts ?? [];

  let text: string | undefined;
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const part of parts) {
    if ('text' in part && part.text) {
      text = (text ?? '') + part.text;
    }
    if ('functionCall' in part && part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args,
      });
    }
  }

  return {
    text: text ?? undefined,
    functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
    tokens: {
      input: data.usageMetadata?.promptTokenCount ?? 0,
      output: data.usageMetadata?.candidatesTokenCount ?? 0,
      total: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

export async function callGeminiChatWithRetry(
  model: string,
  systemInstruction: string,
  messages: ChatMessage[],
  apiKey: string,
  tools?: GeminiTool[],
  maxRetries = 2
): Promise<ChatResponse> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGeminiChat(model, systemInstruction, messages, apiKey, tools);
    } catch (error) {
      const err = error as Error & { status?: number };
      lastError = err;

      const status = err.status;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) break;

      if (status === 429) {
        // Rate limit — exponential backoff
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (status === 500 || status === 503) {
        // Transient server error — short wait
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // All other errors: fail immediately
      throw err;
    }
  }

  throw lastError;
}
