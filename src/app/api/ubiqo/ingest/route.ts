import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { fetchCaptures, extractPhotos } from '@/lib/ubiqo/client';
import { ingestRequestSchema } from '@/lib/ubiqo/types';
import { encryptFirma } from '@/lib/ubiqo/crypto';
import { supabase } from '@/lib/supabase';

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
    // Fetch captures from Ubiqo API
    const captures = await fetchCaptures(form_id, from, to, tz);

    // Filter only completed captures and extract photos
    const completedCaptures = captures.filter(c => c.estatus === 'Completa');

    let discovered = 0;

    // Snapshot total rows for this form before upsert to compute already_processed.
    // ON CONFLICT DO NOTHING means upsert returns nothing for existing rows;
    // we derive duplicates as: discovered - (countAfter - countBefore).
    // NOTE: This count is approximate under concurrent ingests for the same form_id
    // (two simultaneous ingests will both read the same countBefore, slightly skewing
    // the math). The actual dedup is always correct — it's enforced by the DB
    // UNIQUE(ubiqo_grupo, photo_path) constraint. already_processed is informational only.
    const { count: countBefore } = await supabase
      .from('bbm_ubiqo_captures')
      .select('*', { count: 'exact', head: true })
      .eq('ubiqo_form_id', String(form_id));

    for (const capture of completedCaptures) {
      const photos = extractPhotos(capture);

      for (const photo of photos) {
        discovered++;

        const { error } = await supabase
          .from('bbm_ubiqo_captures')
          .upsert(
            {
              ubiqo_grupo: capture.grupo,
              ubiqo_folio: capture.folioEvidence,
              ubiqo_form_id: String(form_id),
              ubiqo_alias: capture.alias,
              ubiqo_username: capture.username,
              ubiqo_estatus: capture.estatus,
              photo_path: photo.url,
              photo_lat: photo.latitud ? parseFloat(photo.latitud) : null,
              photo_lon: photo.longitud ? parseFloat(photo.longitud) : null,
              photo_description: photo.descripcion || null,
              photo_captured_at: capture.fecha,
              url_base: capture.urlBase,
              // firma = CloudFront signed credentials (~24h TTL). Encrypted at rest
              // when BBM_FIRMA_ENCRYPTION_KEY is set (AES-256-GCM); plaintext fallback
              // for dev/local without the key (logs a warning).
              firma: encryptFirma(capture.firma),
            },
            { onConflict: 'ubiqo_grupo,photo_path', ignoreDuplicates: true }
          );

        if (error) {
          // If the upsert was a no-op (conflict ignored), Supabase doesn't error.
          // A real error means something else went wrong.
          console.error('Supabase upsert error:', error.message);
        }
      }
    }

    // already_processed = photos in this batch that already existed in DB
    const { count: countAfter } = await supabase
      .from('bbm_ubiqo_captures')
      .select('*', { count: 'exact', head: true })
      .eq('ubiqo_form_id', String(form_id));

    const actuallyInserted = (countAfter || 0) - (countBefore || 0);
    const alreadyProcessed = Math.max(0, discovered - actuallyInserted);

    const { count: pendingCount } = await supabase
      .from('bbm_ubiqo_captures')
      .select('*', { count: 'exact', head: true })
      .eq('ubiqo_form_id', String(form_id))
      .eq('status', 'pending');

    return NextResponse.json({
      success: true,
      discovered,
      already_processed: alreadyProcessed,
      pending: pendingCount || 0,
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
