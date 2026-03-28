import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';
import { sendAnalysisEmail, isEmailConfigured } from '@/lib/email';
import type { FullAnalysisEmailData } from '@/lib/email';

export async function POST(request: NextRequest) {
  if (!isEmailConfigured) {
    return NextResponse.json(
      { error: 'Email service not configured' },
      { status: 503 }
    );
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = verifyCookie(cookieValue);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body: { log_id?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.log_id || !UUID_REGEX.test(body.log_id)) {
    return NextResponse.json({ error: 'Invalid log_id' }, { status: 400 });
  }

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

  // Extract full analysis data
  const result = logEntry.result_json as Record<string, unknown>;
  const analysis = result?.analysis as Record<string, unknown> | undefined;
  const inventory = analysis?.inventory as { items?: Array<{ name: string; brand?: string; quantity?: string | number }>; total_skus_detected?: number } | undefined;
  const shelfShare = analysis?.shelf_share as { brands?: Array<{ name: string; estimated_share_pct: number }>; dominant_brand?: string } | undefined;
  const pricing = analysis?.pricing as { prices_found?: Array<{ item: string; price: number; currency?: string; type?: string }> } | undefined;
  const compliance = analysis?.compliance as { score?: string } | undefined;
  const condition = analysis?.condition as { cleanliness?: string; notes?: string } | undefined;
  const insights = analysis?.insights as { recommendations?: string[] } | undefined;

  // Generate PDF server-side
  let pdfBuffer: Buffer | undefined;
  try {
    const { generatePDFBuffer } = await import('@/lib/exports/pdf-server');
    pdfBuffer = await generatePDFBuffer(result);
  } catch (err) {
    console.error('PDF generation failed:', err);
    // Continue without PDF
  }

  const emailData: FullAnalysisEmailData = {
    photoType: logEntry.photo_type || undefined,
    severity: logEntry.severity || undefined,
    summary: (analysis?.summary as string) || undefined,
    totalSkus: inventory?.total_skus_detected,
    complianceScore: compliance?.score,
    cleanliness: condition?.cleanliness,
    dominantBrand: shelfShare?.dominant_brand,
    escalated: logEntry.escalated || false,
    processingTime: logEntry.processing_time_ms || undefined,
    inventory: inventory?.items?.slice(0, 20),
    prices: pricing?.prices_found?.slice(0, 10),
    shelfBrands: shelfShare?.brands?.slice(0, 5),
    recommendations: insights?.recommendations?.slice(0, 5),
    conditionNotes: condition?.notes,
    imageBase64: body.image || undefined,
    pdfBuffer,
    fileName: logEntry.image_filename?.replace(/\.[^.]+$/, '') || 'analisis',
  };

  const sent = await sendAnalysisEmail(payload.email, emailData);

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // Update emailed_at
  void (async () => {
    try {
      await supabase
        .from('bbm_analysis_log')
        .update({ emailed_at: new Date().toISOString() })
        .eq('id', body.log_id);
    } catch (e) {
      console.error('Failed to update emailed_at:', e);
    }
  })();

  return NextResponse.json({ success: true });
}
