import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini';
import {
  buildSinglePassPrompt,
  buildConditionEscalationPrompt,
  shouldEscalate,
} from '@/lib/prompts';

export const maxDuration = 60;

interface DemoRequest {
  image: string;
  mime_type?: string;
}

export async function POST(request: NextRequest) {
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
      },
    };

    if (conditionDetail) {
      response.condition_detail = conditionDetail;
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
