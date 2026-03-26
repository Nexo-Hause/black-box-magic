import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini';
import {
  buildSinglePassPrompt,
  buildConditionEscalationPrompt,
  shouldEscalate,
} from '@/lib/prompts';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';

// Hobby plan: 10s hard limit. Pro plan ($20/mo): set maxDuration = 60
export const maxDuration = 60;

interface DemoRequest {
  image: string;
  mime_type?: string;
  fileName?: string;
}

export async function POST(request: NextRequest) {
  // Gate check: require email cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const cookiePayload = cookieValue ? verifyCookie(cookieValue) : null;
  if (!cookiePayload) {
    return NextResponse.json(
      { error: 'Email required. Please enter your email first.', status: 401 },
      { status: 401 }
    );
  }

  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_AI_API_KEY not configured', status: 500 },
      { status: 500 }
    );
  }

  let body: DemoRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  if (!body.image) {
    return NextResponse.json(
      { error: 'Missing image', status: 400 },
      { status: 400 }
    );
  }

  let imageBase64 = body.image;
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    body.mime_type = body.mime_type || dataUrlMatch[1];
    imageBase64 = dataUrlMatch[2];
  }

  const mimeType = body.mime_type || 'image/jpeg';

  const estimatedBytes = (imageBase64.length * 3) / 4;
  if (estimatedBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image too large. Maximum 10MB.', status: 413 },
      { status: 413 }
    );
  }

  try {
    const prompt = buildSinglePassPrompt();
    const result = await analyzeImage(imageBase64, mimeType, prompt, geminiKey);

    let conditionDetail = null;
    let escalated = false;
    let totalTokens = result.tokens;
    let totalTime = result.processing_time_ms;

    const analysis = result.data as Record<string, unknown>;
    if (shouldEscalate(analysis)) {
      escalated = true;
      const conditionPrompt = buildConditionEscalationPrompt();
      const conditionResult = await analyzeImage(
        imageBase64,
        mimeType,
        conditionPrompt,
        geminiKey
      );
      conditionDetail = conditionResult.data;
      totalTime += conditionResult.processing_time_ms;
      totalTokens = {
        input: totalTokens.input + conditionResult.tokens.input,
        output: totalTokens.output + conditionResult.tokens.output,
        total: totalTokens.total + conditionResult.tokens.total,
      };
    }

    // Truncation detection: compare total_skus_detected vs actual items
    const inventory = analysis.inventory as { items?: unknown[]; total_skus_detected?: number } | undefined;
    const truncated = !!(
      inventory?.total_skus_detected &&
      inventory?.items &&
      inventory.total_skus_detected > inventory.items.length
    );

    const response: Record<string, unknown> = {
      success: true,
      client: 'demo',
      analysis: result.data,
      meta: {
        model: result.model,
        tokens: totalTokens,
        processing_time_ms: totalTime,
        engine: 'hybrid-v2',
        escalated,
        truncated,
      },
    };

    if (conditionDetail) {
      response.condition_detail = conditionDetail;
    }

    // Log to Supabase (quick insert, graceful degradation)
    if (supabase) {
      try {
        const { data: user } = await supabase
          .from('bbm_users')
          .select('id, total_analyses')
          .eq('email', cookiePayload.email)
          .single();

        if (user) {
          const logId = crypto.randomUUID();
          const analysisData = result.data as Record<string, unknown>;

          const { error: insertErr } = await supabase.from('bbm_analysis_log').insert({
            id: logId,
            user_id: user.id,
            image_filename: body.fileName || null,
            image_mime_type: mimeType,
            image_size_bytes: Math.round(estimatedBytes),
            photo_type: (analysisData?.photo_type as string) || null,
            severity: (analysisData?.severity as string) || null,
            escalated,
            processing_time_ms: totalTime,
            tokens_total: totalTokens.total,
            model: result.model,
            result_json: response,
          });

          if (!insertErr) {
            response.log_id = logId;
            // Fire-and-forget: update counter
            void (async () => {
              try {
                const { error } = await supabase
                  .from('bbm_users')
                  .update({ total_analyses: (user.total_analyses || 0) + 1, last_seen_at: new Date().toISOString() })
                  .eq('id', user.id);
                if (error) console.error('Counter update failed:', error.message);
              } catch (e) {
                console.error('Counter update exception:', e);
              }
            })();
          }
        }
      } catch (err) {
        console.error('Failed to log analysis:', err);
        // Continue — analysis succeeded, logging failed gracefully
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Demo analysis failed:', message);
    return NextResponse.json(
      { error: `Analysis failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}
