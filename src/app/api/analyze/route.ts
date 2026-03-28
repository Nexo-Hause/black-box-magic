import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { analyzeImage } from '@/lib/gemini';
import {
  buildSinglePassPrompt,
  buildConditionEscalationPrompt,
  shouldEscalate,
} from '@/lib/prompts';
import { getActiveConfig } from '@/lib/engine/config';
import { analyzeWithConfig } from '@/lib/engine/analyzer';

export const maxDuration = 60; // Vercel Pro allows up to 60s

interface AnalyzeRequest {
  image: string;        // base64-encoded image
  mime_type?: string;    // defaults to image/jpeg
  custom_rules?: string; // optional client-specific evaluation rules
  client_id?: string;    // if present, use engine v3 with ClientConfig
}

export async function POST(request: NextRequest) {
  // Auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 }
    );
  }

  // Validate Gemini key
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_AI_API_KEY not configured', status: 500 },
      { status: 500 }
    );
  }

  // Parse body
  let body: AnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  // Validate image
  if (!body.image) {
    return NextResponse.json(
      { error: 'Missing required field: image (base64)', status: 400 },
      { status: 400 }
    );
  }

  // Strip data URL prefix if present
  let imageBase64 = body.image;
  const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    body.mime_type = body.mime_type || dataUrlMatch[1];
    imageBase64 = dataUrlMatch[2];
  }

  const mimeType = body.mime_type || 'image/jpeg';

  // Validate base64 size (rough check — 10MB max)
  const estimatedBytes = (imageBase64.length * 3) / 4;
  if (estimatedBytes > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image too large. Maximum 10MB.', status: 413 },
      { status: 413 }
    );
  }

  try {
    // ─── Engine v3: config-driven analysis ───
    if (body.client_id) {
      const config = await getActiveConfig(body.client_id);
      if (!config) {
        return NextResponse.json(
          { error: `No active config found for client_id: ${body.client_id}`, status: 404 },
          { status: 404 }
        );
      }

      const v3Result = await analyzeWithConfig(imageBase64, mimeType, config, geminiKey);

      return NextResponse.json({
        success: true,
        client: auth.client,
        analysis: v3Result.result,
        meta: {
          model: v3Result.model,
          tokens: v3Result.tokens,
          processing_time_ms: v3Result.processing_time_ms,
          engine: 'engine-v3',
          escalated: v3Result.result.escalations.length > 0,
        },
      });
    }

    // ─── Legacy: PASS 1 — Single-pass adaptive analysis ───
    const prompt = buildSinglePassPrompt(body.custom_rules);
    const result = await analyzeImage(imageBase64, mimeType, prompt, geminiKey);

    let conditionDetail = null;
    let escalated = false;
    let totalTokens = result.tokens;
    let totalTime = result.processing_time_ms;

    // ─── PASS 2: Condition escalation (auto, only when needed) ───
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

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      client: auth.client,
      analysis: result.data,
      meta: {
        model: result.model,
        tokens: totalTokens,
        processing_time_ms: totalTime,
        engine: 'hybrid-v2',
        escalated,
      },
    };

    if (conditionDetail) {
      response.condition_detail = conditionDetail;
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis failed:', message);

    return NextResponse.json(
      { error: `Analysis failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    {
      error: 'Use POST with a JSON body containing base64 image',
      docs: '/api/health',
      status: 405,
    },
    { status: 405 }
  );
}
