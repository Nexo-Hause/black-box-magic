import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { fetchCaptures, extractPhotos } from '@/lib/ubiqo/client';
import { ingestRequestSchema } from '@/lib/ubiqo/types';
import { encryptFirma } from '@/lib/ubiqo/crypto';
import { supabase } from '@/lib/supabase';
import { ingestUbiqoCaptures } from '@/lib/pipeline/ubiqo';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 }
    );
  }

  // Validate Ubiqo token
  if (!process.env.UBIQO_API_TOKEN) {
    return NextResponse.json(
      { error: 'UBIQO_API_TOKEN not configured', status: 500 },
      { status: 500 }
    );
  }

  // Validate Supabase
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured', status: 500 },
      { status: 500 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  // Validate with Zod
  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.issues, status: 400 },
      { status: 400 }
    );
  }

  const { form_id, from, to, tz } = parsed.data;

  try {
    const result = await ingestUbiqoCaptures(
      { form_id, from, to, tz },
      { fetchCaptures, extractPhotos, encryptFirma, supabase }
    );

    return NextResponse.json({
      success: true,
      discovered: result.discovered,
      already_processed: result.alreadyProcessed,
      pending: result.pending,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ubiqo ingest failed:', message);

    return NextResponse.json(
      { error: `Ingest failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST with form_id, from, to', status: 405 },
    { status: 405 }
  );
}
