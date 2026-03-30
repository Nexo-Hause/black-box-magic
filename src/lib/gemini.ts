/**
 * Black Box Magic — Vision Client
 *
 * Image analysis engine with automatic model fallback.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const PRIMARY_MODEL = 'gemini-3.1-flash-lite-preview';
const FALLBACK_MODEL = 'gemini-3-flash-preview';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface AnalysisResult {
  data: Record<string, unknown>;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  processing_time_ms: number;
}

export interface ImageSource {
  base64: string;
  mimeType: string;
  label?: string; // "reference" | "field" — for documentation only
}

async function callGemini(
  model: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<GeminiResponse> {
  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function callGeminiMultiImage(
  model: string,
  images: ImageSource[],
  prompt: string,
  apiKey: string
): Promise<GeminiResponse> {
  const imageParts = images.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64,
    },
  }));

  const response = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [...imageParts, { text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = message.includes('(429)');
      const isServerError = message.includes('(503)') || message.includes('(500)');
      const isRetryable = isRateLimit || isServerError;

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Gemini retryable error (attempt ${attempt + 1}/${MAX_RETRIES}): ${message}. Retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

function extractJSON(text: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    // Try finding first { to last }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Could not extract valid JSON from model response');
  }
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<AnalysisResult> {
  const startTime = Date.now();
  let model = PRIMARY_MODEL;

  let geminiResponse: GeminiResponse;
  try {
    geminiResponse = await callGemini(model, imageBase64, mimeType, prompt, apiKey);
  } catch (error) {
    // Fallback to secondary model
    console.warn(`Primary model failed, falling back to ${FALLBACK_MODEL}:`, error);
    model = FALLBACK_MODEL;
    geminiResponse = await callGemini(model, imageBase64, mimeType, prompt, apiKey);
  }

  const processingTime = Date.now() - startTime;

  const rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No response text from Gemini');
  }

  const data = extractJSON(rawText);

  // Inject metadata
  data.metadata = {
    ...(data.metadata as Record<string, unknown> || {}),
    analysis_version: '1.0',
    model,
    processing_time_ms: processingTime,
  };

  return {
    data,
    model,
    tokens: {
      input: geminiResponse.usageMetadata?.promptTokenCount ?? 0,
      output: geminiResponse.usageMetadata?.candidatesTokenCount ?? 0,
      total: geminiResponse.usageMetadata?.totalTokenCount ?? 0,
    },
    processing_time_ms: processingTime,
  };
}

/**
 * Analyze a field photo against one or more reference images.
 * Sends all images in a single Gemini request.
 * Includes retry logic for rate limits (429) and server errors (500/503).
 */
export async function analyzeWithReferences(
  fieldImage: ImageSource,
  referenceImages: ImageSource[],
  prompt: string,
  apiKey: string,
  timeoutMs: number = 90000
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Reference images first, then field image (order matters for the prompt)
  const allImages = [...referenceImages, fieldImage];

  let model = PRIMARY_MODEL;
  let geminiResponse: GeminiResponse;

  const callWithTimeout = async (m: string) => {
    const result = await Promise.race([
      withRetry(() => callGeminiMultiImage(m, allImages, prompt, apiKey)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Comparison timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    return result;
  };

  try {
    geminiResponse = await callWithTimeout(model);
  } catch (error) {
    console.warn(`Primary model failed for comparison, falling back to ${FALLBACK_MODEL}:`, error);
    model = FALLBACK_MODEL;
    geminiResponse = await callWithTimeout(model);
  }

  const processingTime = Date.now() - startTime;

  const rawText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('No response text from Gemini comparison');
  }

  const data = extractJSON(rawText);

  return {
    data,
    model,
    tokens: {
      input: geminiResponse.usageMetadata?.promptTokenCount ?? 0,
      output: geminiResponse.usageMetadata?.candidatesTokenCount ?? 0,
      total: geminiResponse.usageMetadata?.totalTokenCount ?? 0,
    },
    processing_time_ms: processingTime,
  };
}
