import { analyzeWithConfig } from '@/lib/engine/analyzer';
import type { ClientConfig, EngineV3Result } from '@/types/engine';

export interface TestPhotoResult {
  result: EngineV3Result;
  model: string;
  tokens: { input: number; output: number; total: number };
  processing_time_ms: number;
}

export async function runTestPhoto(
  imageBase64: string,
  mimeType: string,
  config: ClientConfig,
  apiKey: string,
): Promise<TestPhotoResult> {
  const analysis = await analyzeWithConfig(imageBase64, mimeType, config, apiKey);
  return {
    result: analysis.result,
    model: analysis.model,
    tokens: analysis.tokens,
    processing_time_ms: analysis.processing_time_ms,
  };
}
