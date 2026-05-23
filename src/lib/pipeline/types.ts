import type { supabase as SupabaseClientOrNull } from '@/lib/supabase';
import type { downloadPhoto } from '@/lib/ubiqo/ssrf';
import type { analyzePhoto } from '@/lib/analyze';
import type { decryptFirma } from '@/lib/ubiqo/crypto';
import type { downloadPlanogram } from '@/lib/planogram/storage';
import type { buildIncidencePrompt } from '@/lib/planogram/incidence-prompt';
import type { analyzeWithReferences, analyzeImage } from '@/lib/gemini';
import type { parseIncidenceResponse } from '@/lib/planogram/incidence-parser';
import type { fetchCaptures, extractPhotos, buildPhotoUrl } from '@/lib/ubiqo/client';
import type { encryptFirma } from '@/lib/ubiqo/crypto';

type SupabaseClient = NonNullable<typeof SupabaseClientOrNull>;

export interface PipelineDeps {
  downloadPhoto: typeof downloadPhoto;
  analyzePhoto: typeof analyzePhoto;
  decryptFirma: typeof decryptFirma;
  supabase: SupabaseClient;
}

export interface PlanogramPipelineDeps {
  downloadPlanogram: typeof downloadPlanogram;
  downloadPhoto: typeof downloadPhoto;
  buildIncidencePrompt: typeof buildIncidencePrompt;
  analyzeWithReferences: typeof analyzeWithReferences;
  analyzeImage?: typeof analyzeImage;
  parseIncidenceResponse: typeof parseIncidenceResponse;
  supabase: SupabaseClient;
}


export interface IngestParams {
  form_id: string | number;
  from: string;
  to: string;
  tz?: string;
}

export interface TenantInfo {
  accountId: string;
  clientId: string;
}

export interface UbiqoIngestDeps {
  fetchCaptures: typeof fetchCaptures;
  extractPhotos: typeof extractPhotos;
  encryptFirma: typeof encryptFirma;
  supabase: SupabaseClient;
  resolveTenantFromFormId?: (formId: string, supabase: any) => Promise<TenantInfo | null>;
}

export interface PlanogramIngestDeps {
  fetchCaptures: typeof fetchCaptures;
  extractPhotos: typeof extractPhotos;
  buildPhotoUrl: typeof buildPhotoUrl;
  supabase: SupabaseClient;
  resolveTenantFromFormId?: (formId: string, supabase: any) => Promise<TenantInfo | null>;
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

export interface PlanogramIngestResult {
  success: boolean;
  skipped?: 'no planogram assignment' | 'planogram inactive or deleted';
  form_id: string | number;
  planogram_id?: string;
  captures_found?: number;
  discovered?: number;
  skipped_count?: number;
  pending?: number;
}
