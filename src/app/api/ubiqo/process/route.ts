import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { downloadPhoto } from '@/lib/ubiqo/ssrf';
import { decryptFirma } from '@/lib/ubiqo/crypto';
import { analyzePhoto } from '@/lib/analyze';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60;

const MAX_RETRIES = 3;

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
  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_AI_API_KEY not configured', status: 500 },
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

  try {
    // Atomic pick: claim one pending capture
    const { data: rows, error: pickError } = await supabase.rpc('pick_pending_ubiqo_capture');

    if (pickError) {
      console.error('pick_pending_ubiqo_capture error:', pickError.message);
      return NextResponse.json(
        { error: `Failed to pick capture: ${pickError.message}`, status: 500 },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending captures',
      });
    }

    const row = rows[0];

    // Defensive: pick_pending_ubiqo_capture() should always return a 'processing' row.
    // Guard against unlikely race conditions (e.g. manual status change between pick and this check).
    if (row.status !== 'processing') {
      console.warn(`Picked row ${row.id} has unexpected status "${row.status}", skipping`);
      return NextResponse.json({
        success: false,
        message: 'Unexpected row status after pick, skipped',
      });
    }

    try {
      // Reconstruct photo URL: url_base + photo_path + firma
      // Decrypt firma (no-op if stored as plaintext / key not configured).
      const decryptedFirma = decryptFirma(row.firma);
      const urlBase = row.url_base.endsWith('/') ? row.url_base : row.url_base + '/';
      const photoPath = row.photo_path.startsWith('/') ? row.photo_path.slice(1) : row.photo_path;
      const firma = decryptedFirma.startsWith('?') ? decryptedFirma : '?' + decryptedFirma;
      const photoUrl = urlBase + photoPath + firma;

      // Download with SSRF protection
      const { buffer, contentType } = await downloadPhoto(photoUrl);

      // Convert to base64
      const base64 = buffer.toString('base64');

      // Analyze with legacy 2-pass engine
      const customRules = process.env.UBIQO_QSR_CUSTOM_RULES || undefined;
      const result = await analyzePhoto(base64, contentType, customRules);

      // Extract key fields from analysis
      // The Gemini response may include fields beyond the TS type definition
      const analysis = result.analysis;
      const analysisRaw = analysis as unknown as Record<string, unknown>;
      const executionScore = typeof analysisRaw.execution_score === 'number'
        ? analysisRaw.execution_score
        : null;
      const photoType = analysis.photo_type || null;
      const severity = analysis.severity || null;

      // Update row with results
      const { error: updateError } = await supabase
        .from('bbm_ubiqo_captures')
        .update({
          status: 'completed',
          retry_count: 0, // Reset on success
          analysis_result: analysis,
          execution_score: executionScore,
          photo_type: photoType,
          severity,
          escalated: result.meta.escalated,
          model: result.meta.model,
          tokens_total: result.meta.tokens.total,
          processing_time_ms: result.meta.processing_time_ms,
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) {
        console.error('Failed to update completed capture:', updateError.message);
      }

      return NextResponse.json({
        success: true,
        id: row.id,
        status: 'completed',
        execution_score: executionScore,
        photo_type: photoType,
        severity,
        escalated: result.meta.escalated,
        model: result.meta.model,
        processing_time_ms: result.meta.processing_time_ms,
      });
    } catch (error) {
      // Processing failed — retry or mark as failed
      const message = error instanceof Error ? error.message : 'Unknown error';
      const retryCount = (row.retry_count || 0) + 1;

      if (retryCount >= MAX_RETRIES) {
        // Max retries reached — mark as failed
        await supabase
          .from('bbm_ubiqo_captures')
          .update({
            status: 'failed',
            error_message: message,
            retry_count: retryCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      } else {
        // Return to pending for retry
        await supabase
          .from('bbm_ubiqo_captures')
          .update({
            status: 'pending',
            error_message: message,
            retry_count: retryCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }

      console.error(`Process capture ${row.id} failed (attempt ${retryCount}):`, message);

      return NextResponse.json({
        success: false,
        id: row.id,
        error: message,
        retry_count: retryCount,
        status_set: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ubiqo process failed:', message);

    return NextResponse.json(
      { error: `Process failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}

// Reject other methods
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST to process next pending capture', status: 405 },
    { status: 405 }
  );
}
