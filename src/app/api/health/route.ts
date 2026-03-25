import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'Black Box Magic',
    version: '0.2.0',
    engine: 'hybrid-v2',
    status: 'operational',
    description: 'Hybrid prompt engine: single-pass adaptive analysis with automatic condition escalation',
    endpoints: {
      'POST /api/analyze': {
        description: 'Analyze a retail/field photo',
        auth: 'Bearer token required',
        body: {
          image: 'base64-encoded image (required)',
          mime_type: 'image/jpeg | image/png | image/webp (default: image/jpeg)',
          custom_rules: 'Optional client-specific evaluation rules (string)',
        },
        response: {
          photo_type: 'Auto-detected: retail_shelf | facade | condition | promotional | equipment | general',
          priority_facets: 'Facets reordered by relevance to photo type',
          summary: 'Executive summary focused on what matters most',
          severity: 'CRITICAL | MODERATE | MINOR | N/A',
          analysis: 'Full 7-facet analysis (inventory, shelf_share, pricing, compliance, condition, context, insights)',
          condition_detail: 'Detailed remediation plan (only when condition issues detected)',
          meta: {
            engine: 'hybrid-v2',
            escalated: 'true if condition escalation was triggered',
          },
        },
        escalation_triggers: [
          'severity = CRITICAL or MODERATE',
          'cleanliness = DIRTY',
          'displays = DAMAGED',
          'safety_issues not empty',
        ],
      },
    },
  });
}
