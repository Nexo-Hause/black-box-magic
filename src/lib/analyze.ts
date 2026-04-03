/**
 * Black Box Magic -- Legacy 2-pass analysis
 *
 * Extracts the 2-pass analysis logic from the /api/analyze route
 * so it can be reused by other pipelines (e.g., Ubiqo ingest).
 *
 * Pass 1: Single-pass adaptive analysis (all 7 facets)
 * Pass 2: Condition escalation (only when severity warrants it)
 */

import { analyzeImage } from '@/lib/gemini';
import {
  buildSinglePassPrompt,
  buildConditionEscalationPrompt,
  shouldEscalate,
} from '@/lib/prompts';
import type { AnalysisData, ConditionDetail } from '@/types/analysis';

export interface AnalyzePhotoResult {
  analysis: AnalysisData;
  conditionDetail?: ConditionDetail;
  meta: {
    model: string;
    tokens: { input: number; output: number; total: number };
    processing_time_ms: number;
    escalated: boolean;
  };
}

/**
 * Run the legacy 2-pass analysis on a single photo.
 *
 * @param imageBase64 - Base64-encoded image (no data URL prefix)
 * @param mimeType - MIME type (e.g., "image/jpeg")
 * @param customRules - Optional client-specific evaluation rules
 * @returns Analysis result with optional condition detail and aggregated metadata
 */
export async function analyzePhoto(
  imageBase64: string,
  mimeType: string,
  customRules?: string
): Promise<AnalyzePhotoResult> {
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (!geminiKey) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  // --- Pass 1: Single-pass adaptive analysis ---
  const prompt = buildSinglePassPrompt(customRules);
  const result = await analyzeImage(imageBase64, mimeType, prompt, geminiKey);

  let conditionDetail: ConditionDetail | undefined;
  let escalated = false;
  let totalTokens = { ...result.tokens };
  let totalTime = result.processing_time_ms;

  // --- Pass 2: Condition escalation (auto, only when needed) ---
  const analysisData = result.data as Record<string, unknown>;
  if (shouldEscalate(analysisData)) {
    escalated = true;
    const conditionPrompt = buildConditionEscalationPrompt();
    const conditionResult = await analyzeImage(
      imageBase64,
      mimeType,
      conditionPrompt,
      geminiKey
    );

    conditionDetail = conditionResult.data as unknown as ConditionDetail;
    totalTime += conditionResult.processing_time_ms;
    totalTokens = {
      input: totalTokens.input + conditionResult.tokens.input,
      output: totalTokens.output + conditionResult.tokens.output,
      total: totalTokens.total + conditionResult.tokens.total,
    };
  }

  return {
    analysis: result.data as unknown as AnalysisData,
    conditionDetail,
    meta: {
      model: result.model,
      tokens: {
        input: totalTokens.input,
        output: totalTokens.output,
        total: totalTokens.total,
      },
      processing_time_ms: totalTime,
      escalated,
    },
  };
}
