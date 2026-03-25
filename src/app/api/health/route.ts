import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'Black Box Magic',
    version: '0.1.0',
    status: 'operational',
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
          summary: 'Executive summary',
          inventory: 'Products detected with quantities',
          shelf_share: 'Brand space distribution',
          pricing: 'Prices and strategies',
          compliance: 'Execution quality score',
          condition: 'Physical state assessment',
          context: 'Location and environment',
          insights: 'Strengths, opportunities, threats, recommendations',
        },
      },
    },
  });
}
