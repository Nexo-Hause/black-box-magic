import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { generateShareToken } from '@/lib/share-token';

/**
 * POST /api/demo/share
 *
 * Genera un link compartible para que prospectos accedan sin pasar por el email gate.
 * Solo usuarios autenticados (con cookie válida) pueden generar links.
 *
 * Response: { token, url, expiresInHours }
 */
export async function POST(req: NextRequest) {
  // Solo usuarios autenticados pueden generar share links
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  const payload = cookieValue ? verifyCookie(cookieValue) : null;

  if (!payload) {
    return NextResponse.json(
      { error: 'No autenticado — inicia sesión primero' },
      { status: 401 }
    );
  }

  try {
    const token = await generateShareToken(payload.email);

    // Construir URL compartible
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const shareUrl = `${baseUrl}/demo?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      token,
      url: shareUrl,
      expiresInHours: 48,
    });
  } catch (e) {
    console.error('Error al generar share token:', e);
    return NextResponse.json(
      { error: 'Error interno al generar el link' },
      { status: 500 }
    );
  }
}
