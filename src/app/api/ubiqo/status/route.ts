import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  // Auth
  const auth = authenticate(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, status: 401 },
      { status: 401 }
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
    // Count by status — 4 parallel queries
    const [pendingRes, processingRes, completedRes, failedRes] = await Promise.all([
      supabase
        .from('bbm_ubiqo_captures')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('bbm_ubiqo_captures')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing'),
      supabase
        .from('bbm_ubiqo_captures')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('bbm_ubiqo_captures')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ]);

    const pending = pendingRes.count || 0;
    const processing = processingRes.count || 0;
    const completed = completedRes.count || 0;
    const failed = failedRes.count || 0;

    // Get last ingest timestamp (most recent created_at)
    const { data: lastIngestRow } = await supabase
      .from('bbm_ubiqo_captures')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get last completed timestamp (most recent analyzed_at)
    const { data: lastCompletedRow } = await supabase
      .from('bbm_ubiqo_captures')
      .select('analyzed_at')
      .eq('status', 'completed')
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();

    const lastIngestAt = lastIngestRow?.created_at || null;
    const lastCompletedAt = lastCompletedRow?.analyzed_at || null;

    // Alert if too many failures
    const alert = failed > 5
      ? `High failure count: ${failed} captures in failed state`
      : null;

    return NextResponse.json({
      success: true,
      pending,
      processing,
      completed,
      failed,
      last_ingest_at: lastIngestAt,
      last_completed_at: lastCompletedAt,
      alert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ubiqo status query failed:', message);

    return NextResponse.json(
      { error: `Status query failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}
