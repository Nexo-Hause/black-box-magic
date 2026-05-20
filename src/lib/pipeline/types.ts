import type { supabase as SupabaseClientOrNull } from '@/lib/supabase';
import type { downloadPhoto } from '@/lib/ubiqo/ssrf';
import type { analyzePhoto } from '@/lib/analyze';
import type { decryptFirma } from '@/lib/ubiqo/crypto';
import type { downloadPlanogram } from '@/lib/planogram/storage';
import type { buildIncidencePrompt } from '@/lib/planogram/incidence-prompt';
import type { analyzeWithReferences } from '@/lib/gemini';
import type { parseIncidenceResponse } from '@/lib/planogram/incidence-parser';

type SupabaseClient = NonNullable<typeof SupabaseClientOrNull>;

export interface PipelineDeps {
  downloadPhoto: typeof downloadPhoto;
  analyzePhoto: typeof analyzePhoto;
  decryptFirma: typeof decryptFirma;
  supabase: SupabaseClient;
}

export interface PlanogramPipelineDeps extends PipelineDeps {
  downloadPlanogram: typeof downloadPlanogram;
  buildIncidencePrompt: typeof buildIncidencePrompt;
  analyzeWithReferences: typeof analyzeWithReferences;
  parseIncidenceResponse: typeof parseIncidenceResponse;
}

export interface ProcessResult {
  status: 'completed';
  captureId: string;
  model: string;
  tokens: number;
  processingTimeMs: number;
  escalated: boolean;
}

export interface IngestResult {
  discovered: number;
  alreadyProcessed: number;
  pending: number;
}
