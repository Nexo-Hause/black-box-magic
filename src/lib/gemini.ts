/**
 * Black Box Magic — Gemini Vision Client
 *
 * Calls Gemini 3.1 Flash-Lite for image analysis.
 * Falls back to Gemini 3 Flash if needed.
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
          maxOutputTokens: 4096,
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
