import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { supabase } from '@/lib/supabase';

export const maxDuration = 15;

export async function GET(request: NextRequest) {
  // Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status }
    );
  }

  const { payload } = auth;

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service is unavailable', status: 503 },
      { status: 503 }
    );
  }

  try {
    // Query historical client configs for this client_id
    const { data: history, error } = await supabase
      .from('bbm_client_configs')
      .select('id, client_id, client_name, status, industry, version, config, partial_config, created_at, updated_at')
      .eq('client_id', payload.clientId)
      .order('version', { ascending: false });

    if (error) {
      console.error('[onboarding/history] Error fetching history:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch config history', status: 500 },
        { status: 500 }
      );
    }

    return NextResponse.json({
      history: history.map(item => ({
        id: item.id,
        clientId: item.client_id,
        clientName: item.client_name,
        status: item.status,
        industry: item.industry,
        version: item.version,
        config: item.config,
        partialConfig: item.partial_config,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[onboarding/history] Server error:', message);
    return NextResponse.json(
      { error: 'Internal server error', status: 500 },
      { status: 500 }
    );
  }
}
