import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { sendAnalysisEmail, isEmailConfigured } from '@/lib/email';

export async function POST(request: NextRequest) {
  if (!isEmailConfigured) {
    return NextResponse.json(
      { error: 'Email service not configured' },
      { status: 503 }
    );
  }

  // Verify user cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = verifyCookie(cookieValue);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body: { log_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.log_id || !UUID_REGEX.test(body.log_id)) {
    return NextResponse.json({ error: 'Invalid log_id' }, { status: 400 });
  }

  // Fetch analysis from DB
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { data: logEntry, error: fetchError } = await supabase
    .from('bbm_analysis_log')
    .select('*, bbm_users!inner(email)')
    .eq('id', body.log_id)
    .single();

  if (fetchError || !logEntry) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Security: verify user owns this analysis
  const userEmail = (logEntry.bbm_users as { email: string })?.email;
  if (userEmail !== payload.email) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const result = logEntry.result_json as Record<string, unknown>;
  const analysis = result?.analysis as Record<string, unknown> | undefined;
  const meta = result?.meta as Record<string, unknown> | undefined;

  const sent = await sendAnalysisEmail(payload.email, {
    photoType: logEntry.photo_type || undefined,
    severity: logEntry.severity || undefined,
    summary: (analysis?.summary as string) || undefined,
    totalSkus: (analysis?.inventory as { total_skus_detected?: number })?.total_skus_detected,
    complianceScore: (analysis?.compliance as { score?: string })?.score,
    escalated: logEntry.escalated || false,
    processingTime: logEntry.processing_time_ms || undefined,
  });

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // Update emailed_at
  supabase
    .from('bbm_analysis_log')
    .update({ emailed_at: new Date().toISOString() })
    .eq('id', body.log_id)
    .then(({ error }) => {
      if (error) console.error('Failed to update emailed_at:', error.message);
    });

  return NextResponse.json({ success: true });
}
