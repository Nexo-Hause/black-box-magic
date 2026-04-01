/**
 * Planogram Webhook — Receive Ubiqo push notifications (SKELETON)
 *
 * TODO: Webhook format not yet agreed with Ubiqo.
 * This is a skeleton with HMAC signature verification and anti-replay.
 * Payload parsing depends on final Ubiqo webhook spec.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabase } from '@/lib/supabase';

export const maxDuration = 10;

// ─── HMAC Signature Verification ───

function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');

  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

// ─── Route handler ───

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.UBIQO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('UBIQO_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured', status: 503 },
      { status: 503 },
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado.', status: 503 },
      { status: 503 },
    );
  }

  // 1. Read raw body for signature verification
  const rawBody = await request.text();

  // 2. Verify HMAC signature
  const signature = request.headers.get('x-ubiqo-signature') || '';
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing X-Ubiqo-Signature header', status: 401 },
      { status: 401 },
    );
  }

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json(
      { error: 'Invalid signature', status: 401 },
      { status: 401 },
    );
  }

  // 3. Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', status: 400 },
      { status: 400 },
    );
  }

  // 4. Anti-replay: reject if timestamp > 5 minutes old
  // TODO: Field name depends on Ubiqo webhook format
  const timestamp = payload.timestamp as string | undefined;
  if (timestamp) {
    const eventTime = new Date(timestamp).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (isNaN(eventTime) || Math.abs(now - eventTime) > fiveMinutes) {
      return NextResponse.json(
        { error: 'Timestamp too old or invalid (anti-replay)', status: 400 },
        { status: 400 },
      );
    }
  }

  try {
    // 5. Extract fields from payload
    // TODO: Field names depend on Ubiqo webhook format
    const formId = payload.form_id as string | undefined;
    const captureId = payload.capture_id as string | undefined; // TODO: actual field name
    const alias = payload.alias as string | undefined;          // TODO: actual field name
    const capturedAt = payload.captured_at as string | undefined; // TODO: actual field name
    const photoUrls = payload.photo_urls as string[] | undefined; // TODO: actual field name

    if (!formId || !captureId) {
      return NextResponse.json(
        { error: 'Missing required fields: form_id, capture_id', status: 400 },
        { status: 400 },
      );
    }

    // 6. Lookup planogram assignment
    const { data: assignment, error: assignErr } = await supabase
      .from('bbm_planogram_assignments')
      .select('planogram_id')
      .eq('form_id', formId)
      .maybeSingle();

    if (assignErr) {
      console.error('Error looking up assignment:', assignErr.message);
      return NextResponse.json(
        { error: `Assignment lookup failed: ${assignErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    if (!assignment) {
      // No planogram assigned for this form — acknowledge but skip
      return new NextResponse(null, { status: 202 });
    }

    // 7. Insert pending incidence
    const { error: insertErr } = await supabase
      .from('bbm_incidences')
      .upsert(
        {
          planogram_id: assignment.planogram_id,
          ubiqo_capture_id: captureId,
          promoter_name: alias || null,
          store_name: alias || null,      // TODO: separate store field from Ubiqo
          photo_captured_at: capturedAt || null,
          field_photo_paths: photoUrls || [],
          status: 'pending',
        },
        {
          onConflict: 'ubiqo_capture_id',
          ignoreDuplicates: true,
        },
      );

    if (insertErr) {
      console.error('Error inserting incidence from webhook:', insertErr.message);
      return NextResponse.json(
        { error: `Insert failed: ${insertErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 8. Return 202 Accepted
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Webhook processing failed:', message);
    return NextResponse.json(
      { error: `Webhook error: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
