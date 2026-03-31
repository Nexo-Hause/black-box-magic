import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithReferences, type ImageSource } from '@/lib/gemini';
import { buildComparisonPrompt } from '@/lib/engine/prompt-builder';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import type {
  ReferenceData,
  ReferenceItem,
  RawComparisonResponse,
  ComparisonResult,
  ComparisonMetrics,
  MatchedItem,
  MissingItem,
  UnexpectedItem,
  PriceDiscrepancy,
  GapDetail,
  ReferenceType,
} from '@/types/comparison';

export const maxDuration = 90;

// ─── Request types ───

interface CompareRequest {
  referenceImage: string;
  fieldImage: string;
  referenceType: ReferenceType;
  referenceSection?: string;
  referenceItems?: Array<{
    id: string;
    name: string;
    category?: string;
    expectedPosition?: string;
    expectedPrice?: number;
    expectedQuantity?: number;
    attributes?: Record<string, string>;
  }>;
}

// ─── Helpers ───

const VALID_REFERENCE_TYPES: ReferenceType[] = [
  'planogram',
  'brand_manual',
  'checklist',
  'blueprint',
];

function extractBase64(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Formato de data URL inválido');
  return { mimeType: match[1], base64: match[2] };
}

function estimateBase64Bytes(dataUrl: string): number {
  // Remove the data URL prefix before estimating
  const commaIndex = dataUrl.indexOf(',');
  const base64Part = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return (base64Part.length * 3) / 4;
}

function buildMetrics(
  rawResponse: RawComparisonResponse,
  referenceData: ReferenceData,
): { metrics: ComparisonMetrics; complianceScore: number } {
  const found = rawResponse.items.filter((i) => i.found);
  const totalExpected =
    referenceData.items.length > 0
      ? referenceData.items.length
      : rawResponse.items.length;

  const totalFound = found.length;
  const assortment = totalExpected > 0 ? (totalFound / totalExpected) * 100 : 0;

  const totalCorrectPosition = found.filter((i) => i.correctPosition).length;
  const positioning =
    totalFound > 0 ? (totalCorrectPosition / totalFound) * 100 : 0;

  // Price matching — $1 tolerance
  const totalPriceVisible = found.filter((i) => i.observedPrice != null).length;
  const priceMatches = found.filter((i) => {
    const ref = referenceData.items.find(
      (r) => r.id === i.referenceItemId,
    );
    return (
      ref?.expectedPrice != null &&
      i.observedPrice != null &&
      Math.abs(ref.expectedPrice - i.observedPrice) < 1
    );
  });
  const totalPriceMatch = priceMatches.length;
  const pricing =
    totalPriceVisible > 0 ? (totalPriceMatch / totalPriceVisible) * 100 : 100;

  const gaps = Array.isArray(rawResponse.gaps) ? rawResponse.gaps.length : (typeof rawResponse.gaps === 'number' ? rawResponse.gaps : 0);

  // Score compuesto PROVISIONAL — pesos arbitrarios solo para demo.
  // En producción, los pesos los define el cliente o no se usa score compuesto.
  const complianceScore =
    assortment * 0.4 + positioning * 0.3 + pricing * 0.3;

  const metrics: ComparisonMetrics = {
    assortment: Math.round(assortment * 100) / 100,
    positioning: Math.round(positioning * 100) / 100,
    pricing: Math.round(pricing * 100) / 100,
    gaps,
    totalExpected,
    totalFound,
    totalCorrectPosition,
    totalPriceMatch,
    totalPriceVisible,
  };

  return { metrics, complianceScore: Math.round(complianceScore * 100) / 100 };
}

function mapToComparisonResult(
  rawResponse: RawComparisonResponse,
  referenceData: ReferenceData,
  model: string,
  tokens: { input: number; output: number; total: number },
  processingTimeMs: number,
): ComparisonResult {
  const { metrics, complianceScore } = buildMetrics(rawResponse, referenceData);

  // Build matched items (found = true)
  const matches: MatchedItem[] = rawResponse.items
    .filter((i) => i.found)
    .map((i) => ({
      referenceItemId: i.referenceItemId || '',
      name: i.name,
      category: i.category,
      correctPosition: i.correctPosition,
      observedPosition: i.observedPosition,
      observedPrice: i.observedPrice,
    }));

  // Build missing items (found = false)
  const missing: MissingItem[] = rawResponse.items
    .filter((i) => !i.found)
    .map((i) => {
      const ref = referenceData.items.find((r) => r.id === i.referenceItemId);
      return {
        referenceItemId: i.referenceItemId || '',
        name: i.name,
        expectedPosition: ref?.expectedPosition || i.observedPosition,
        reason: i.observedPosition ? `Esperado en: ${i.observedPosition}` : undefined,
      };
    });

  // Unexpected items
  const unexpected: UnexpectedItem[] = (rawResponse.unexpectedItems || []).map(
    (u) => ({
      name: u.name,
      observedPosition: u.observedPosition,
      observedPrice: u.observedPrice,
    }),
  );

  // Gap details
  const gapDetails: GapDetail[] = Array.isArray(rawResponse.gaps)
    ? rawResponse.gaps.map((g) => ({
        location: g.location,
        expectedProduct: g.expectedProduct,
      }))
    : [];

  // Price discrepancies
  const priceDiscrepancies: PriceDiscrepancy[] = rawResponse.items
    .filter((i) => i.found && i.observedPrice != null)
    .map((i) => {
      const ref = referenceData.items.find((r) => r.id === i.referenceItemId);
      if (
        ref?.expectedPrice == null ||
        i.observedPrice == null ||
        Math.abs(ref.expectedPrice - i.observedPrice) < 1
      ) {
        return null;
      }
      return {
        referenceItemId: i.referenceItemId || '',
        name: i.name,
        expectedPrice: ref.expectedPrice,
        observedPrice: i.observedPrice,
        difference: Math.round((i.observedPrice - ref.expectedPrice) * 100) / 100,
      };
    })
    .filter((d): d is PriceDiscrepancy => d !== null);

  return {
    complianceScore,
    metrics,
    matches,
    missing,
    unexpected,
    priceDiscrepancies,
    gapDetails,
    summary: rawResponse.summary,
    referenceType: referenceData.type,
    referenceSection: referenceData.section,
    coverage: rawResponse.coverage,
    photoQuality: rawResponse.photoQuality,
    processingTimeMs,
    model,
    tokens,
  };
}

// ─── Rate limiting (in-memory, resets on deploy) ───

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Route handler ───

export async function POST(request: NextRequest) {
  // 1. Auth — require email cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const cookiePayload = cookieValue ? verifyCookie(cookieValue) : null;
  if (!cookiePayload) {
    return NextResponse.json(
      { error: 'Se requiere email. Ingresa tu email primero.', status: 401 },
      { status: 401 },
    );
  }

  // 1b. Rate limit
  if (!checkRateLimit(cookiePayload.email)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.', status: 429 },
      { status: 429 },
    );
  }

  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_AI_API_KEY no configurada', status: 500 },
      { status: 500 },
    );
  }

  // 2. Parse request body
  let body: CompareRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'JSON inválido en el cuerpo de la petición', status: 400 },
      { status: 400 },
    );
  }

  // 3. Validate required fields
  if (!body.referenceImage || !body.fieldImage) {
    return NextResponse.json(
      { error: 'Se requieren ambas imágenes: referenceImage y fieldImage', status: 400 },
      { status: 400 },
    );
  }

  if (!body.referenceType || !VALID_REFERENCE_TYPES.includes(body.referenceType)) {
    return NextResponse.json(
      {
        error: `referenceType inválido. Valores permitidos: ${VALID_REFERENCE_TYPES.join(', ')}`,
        status: 400,
      },
      { status: 400 },
    );
  }

  // 4. Validate and extract images
  let referenceImageData: { base64: string; mimeType: string };
  let fieldImageData: { base64: string; mimeType: string };
  try {
    referenceImageData = extractBase64(body.referenceImage);
    fieldImageData = extractBase64(body.fieldImage);
  } catch {
    return NextResponse.json(
      { error: 'Formato de imagen inválido. Se espera data URL base64 (data:image/...;base64,...)', status: 400 },
      { status: 400 },
    );
  }

  // 5. Size check — 10MB total
  const totalBytes =
    estimateBase64Bytes(body.referenceImage) +
    estimateBase64Bytes(body.fieldImage);
  if (totalBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Las imágenes exceden el límite de 10MB en total.', status: 413 },
      { status: 413 },
    );
  }

  // 6. Build ReferenceData
  const referenceItems: ReferenceItem[] = (body.referenceItems || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    expectedPosition: item.expectedPosition,
    expectedPrice: item.expectedPrice,
    expectedQuantity: item.expectedQuantity,
    attributes: item.attributes,
  }));

  const referenceData: ReferenceData = {
    type: body.referenceType,
    section: body.referenceSection,
    items: referenceItems,
  };

  try {
    // 7. Build prompt
    const prompt = buildComparisonPrompt(referenceData);

    // 8. Call Gemini with both images
    const referenceSource: ImageSource = {
      base64: referenceImageData.base64,
      mimeType: referenceImageData.mimeType,
      label: 'reference',
    };
    const fieldSource: ImageSource = {
      base64: fieldImageData.base64,
      mimeType: fieldImageData.mimeType,
      label: 'field',
    };

    const result = await analyzeWithReferences(
      fieldSource,
      [referenceSource],
      prompt,
      geminiKey,
    );

    // 9. Parse raw response and calculate server-side metrics
    const rawResponse = result.data as unknown as RawComparisonResponse;
    const comparisonResult = mapToComparisonResult(
      rawResponse,
      referenceData,
      result.model,
      result.tokens,
      result.processing_time_ms,
    );

    // 10. Log to Supabase (graceful degradation)
    let logId: string | undefined;
    if (supabase) {
      try {
        const { data: user } = await supabase
          .from('bbm_users')
          .select('id')
          .eq('email', cookiePayload.email)
          .single();

        if (user) {
          logId = crypto.randomUUID();
          const { error: insertErr } = await supabase
            .from('bbm_comparison_log')
            .insert({
              id: logId,
              user_id: user.id,
              reference_type: referenceData.type,
              reference_section: referenceData.section || null,
              reference_items_count: referenceItems.length,
              compliance_score: comparisonResult.complianceScore,
              assortment_pct: comparisonResult.metrics.assortment,
              positioning_pct: comparisonResult.metrics.positioning,
              pricing_pct: comparisonResult.metrics.pricing,
              total_expected: comparisonResult.metrics.totalExpected,
              total_found: comparisonResult.metrics.totalFound,
              gaps: comparisonResult.metrics.gaps,
              photo_quality: comparisonResult.photoQuality,
              coverage: comparisonResult.coverage,
              processing_time_ms: result.processing_time_ms,
              tokens_total: result.tokens.total,
              model: result.model,
              result_json: comparisonResult,
            });

          if (insertErr) {
            console.error('Error al insertar log de comparación:', insertErr.message);
            logId = undefined;
          }
        }
      } catch (err) {
        console.error('Falló el logging de comparación:', err);
        // Continue — comparison succeeded, logging failed gracefully
      }
    }

    return NextResponse.json({
      success: true,
      comparison: comparisonResult,
      log_id: logId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Comparación falló:', message);
    return NextResponse.json(
      { error: `La comparación falló: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
