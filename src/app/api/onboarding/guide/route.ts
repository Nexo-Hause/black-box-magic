import { NextRequest, NextResponse } from 'next/server';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { callGeminiChatWithRetry } from '@/lib/gemini-chat';

export const maxDuration = 30;

const GUIDE_SYSTEM_INSTRUCTION = `
Eres un experto en auditoría física y operaciones de Black Box Magic. Tu tarea es generar exactamente 4 preguntas guía hiper-específicas para la industria o sector que el usuario describa.
Estas preguntas deben guiar al usuario a formular las reglas de negocio para que nuestro motor de IA analice fotos de sus puntos físicos (locales, bodegas, oficinas, sucursales, obras, etc.).
Las preguntas deben ser concisas, redactadas en español mexicano profesional (usando el pronombre "tú") y adaptadas con precisión a los retos típicos del sector mencionado (ej. orden, higiene, seguridad, inventario, presentación o cumplimiento).

Debes responder ÚNICAMENTE con un arreglo JSON de exactamente 4 cadenas de texto (strings).
No incluyas markdown, bloques de código \`\`\`json, ni ningún texto explicativo. Solo el arreglo JSON.

Ejemplo de respuesta válida:
[
  "¿Cómo deben estar organizados los elementos en el mostrador principal para cumplir con tu estándar?",
  "¿Qué condiciones de limpieza o higiene en la zona de preparación son críticas e inaceptables?",
  "¿Qué herramientas de seguridad o de trabajo obligatorias deben portar los colaboradores en las fotos?",
  "¿Cuáles son los productos o materiales específicos cuya presencia o ausencia deseas monitorear?"
]
`;

const FALLBACK_QUESTIONS = [
  '¿Cuáles son las áreas o zonas más importantes que necesitas auditar visualmente a través de fotografías?',
  '¿Qué elementos específicos de orden, limpieza, inventario o exhibición deben estar presentes o ausentes?',
  '¿Cuáles son las fallas operativas o condiciones críticas que consideras inaceptables en tu negocio?',
  '¿Tienes algún estándar de calidad o manual de marca que los colaboradores deban cumplir de forma rigurosa?'
];

export async function POST(request: NextRequest) {
  // 1. Verify Onboarding Auth
  const auth = await requireOnboardingAuth(request);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error, status: auth.status },
      { status: auth.status }
    );
  }

  // 2. Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 }
    );
  }

  if (typeof rawBody !== 'object' || rawBody === null || !('industry' in rawBody)) {
    return NextResponse.json(
      { error: 'El campo "industry" es requerido en el cuerpo de la petición.', status: 400 },
      { status: 400 }
    );
  }

  const { industry } = rawBody as { industry: unknown };
  if (typeof industry !== 'string' || !industry.trim()) {
    return NextResponse.json(
      { error: 'El campo "industry" debe ser una cadena de texto no vacía.', status: 400 },
      { status: 400 }
    );
  }

  const sanitizedIndustry = industry.trim().slice(0, 100);

  // 3. Obtain API Key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('[onboarding/guide] GOOGLE_AI_API_KEY no está configurada. Retornando fallbacks.');
    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  }

  // 4. Call Gemini 3.5 Flash
  try {
    const userPrompt = `Genera las 4 preguntas guía para la industria o sector: "${sanitizedIndustry}"`;
    const response = await callGeminiChatWithRetry(
      'gemini-3.5-flash',
      GUIDE_SYSTEM_INSTRUCTION,
      [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      apiKey,
      undefined,
      1 // 1 retry
    );

    const rawText = response.text?.trim() ?? '';
    if (!rawText) {
      throw new Error('Gemini retornó un texto vacío.');
    }

    // Strip potential markdown blocks
    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(stripped);

    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(q => typeof q === 'string')) {
      return NextResponse.json({ questions: parsed });
    } else {
      console.warn('[onboarding/guide] El formato de Gemini no coincide con 4 preguntas. Usando fallbacks. Texto raw:', rawText);
      return NextResponse.json({ questions: FALLBACK_QUESTIONS });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[onboarding/guide] Llamada fallida a Gemini para guías:', errMsg);
    // Return structured fallbacks in case of transient API error or rate limiting
    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get('industry');

  if (!industry || !industry.trim()) {
    return NextResponse.json(
      {
        message: '¡Bienvenido al Playground del Onboarding de Black Box Magic!',
        tip: 'Para realizar una demostración rápida directamente en tu navegador, añade la industria en la URL.',
        example: '/api/onboarding/guide?industry=Hospitales y Clínicas',
        status: 200
      },
      { status: 200 }
    );
  }

  const sanitizedIndustry = industry.trim().slice(0, 100);

  // Obtain API Key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('[onboarding/guide] GOOGLE_AI_API_KEY no está configurada.');
    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  }

  // Call Gemini 3.5 Flash
  try {
    const userPrompt = `Genera las 4 preguntas guía para la industria o sector: "${sanitizedIndustry}"`;
    const response = await callGeminiChatWithRetry(
      'gemini-3.5-flash',
      GUIDE_SYSTEM_INSTRUCTION,
      [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      apiKey,
      undefined,
      1 // 1 retry
    );

    const rawText = response.text?.trim() ?? '';
    if (!rawText) {
      throw new Error('Gemini retornó un texto vacío.');
    }

    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(stripped);

    if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(q => typeof q === 'string')) {
      return NextResponse.json({ questions: parsed });
    } else {
      console.warn('[onboarding/guide] Formato inválido en demo GET. Usando fallbacks.');
      return NextResponse.json({ questions: FALLBACK_QUESTIONS });
    }
  } catch (error) {
    console.error('[onboarding/guide] Error en demo GET:', error);
    return NextResponse.json({ questions: FALLBACK_QUESTIONS });
  }
}
