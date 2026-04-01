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
    const { searchParams } = new URL(request.url);

    // Parse query params
    const formId = searchParams.get('form_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const alias = searchParams.get('alias');
    const minScore = searchParams.get('min_score');
    const maxScore = searchParams.get('max_score');
    const severity = searchParams.get('severity');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate and clamp limit/offset
    let limit = limitParam ? parseInt(limitParam, 10) : 50;
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;

    let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    if (isNaN(offset) || offset < 0) offset = 0;

    // Build query — only completed captures
    let query = supabase
      .from('bbm_ubiqo_captures')
      .select('*', { count: 'exact' })
      .eq('status', 'completed')
      .order('analyzed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters dynamically
    if (formId) {
      query = query.eq('ubiqo_form_id', formId);
    }

    if (from) {
      query = query.gte('photo_captured_at', from);
    }

    if (to) {
      query = query.lte('photo_captured_at', to);
    }

    if (alias) {
      if (alias.length > 200) {
        return NextResponse.json(
          { error: 'Alias filter too long (max 200 chars)', status: 400 },
          { status: 400 }
        );
      }
      query = query.ilike('ubiqo_alias', `%${alias}%`);
    }

    if (minScore) {
      const min = parseInt(minScore, 10);
      if (!isNaN(min)) {
        query = query.gte('execution_score', min);
      }
    }

    if (maxScore) {
      const max = parseInt(maxScore, 10);
      if (!isNaN(max)) {
        query = query.lte('execution_score', max);
      }
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Supabase query error:', error.message);
      return NextResponse.json(
        { error: `Query failed: ${error.message}`, status: 500 },
        { status: 500 }
      );
    }

    // Strip sensitive fields from results (firma contains signed credentials)
    const results = (data || []).map(row => {
      const { firma, url_base, ...rest } = row;
      return rest;
    });

    return NextResponse.json({
      success: true,
      total: count || 0,
      limit,
      offset,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ubiqo results query failed:', message);

    return NextResponse.json(
      { error: `Query failed: ${message}`, status: 500 },
      { status: 500 }
    );
  }
}
