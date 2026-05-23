import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { requireOnboardingAuth } from '@/lib/onboarding/auth';
import { callGeminiChatWithRetry } from '@/lib/gemini-chat';

vi.mock('@/lib/onboarding/auth', () => ({
  requireOnboardingAuth: vi.fn(),
}));

vi.mock('@/lib/gemini-chat', () => ({
  callGeminiChatWithRetry: vi.fn(),
  CHAT_MODEL: 'gemini-3.5-flash',
  SYNTHESIS_MODEL: 'gemini-3.5-flash',
}));

describe('POST /api/onboarding/guide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';
  });

  it('debe retornar error de autenticación si requireOnboardingAuth falla', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      error: 'Unauthorized',
      status: 401,
    } as any);

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({ industry: 'Manufactura' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('debe retornar 400 si el cuerpo no contiene la propiedad industry', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      clientId: 'cli-test',
      clientName: 'Test Client',
      email: 'test@example.com',
    } as any);

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('industry');
  });

  it('debe retornar 400 si el campo industry está vacío o no es una cadena de texto', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      clientId: 'cli-test',
      clientName: 'Test Client',
      email: 'test@example.com',
    } as any);

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({ industry: '   ' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cadena de texto no vacía');
  });

  it('debe retornar las 4 preguntas de Gemini si éste responde con un JSON válido', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      clientId: 'cli-test',
      clientName: 'Test Client',
      email: 'test@example.com',
    } as any);

    const mockQuestions = [
      '¿Qué medidas de seguridad en andamios son obligatorias?',
      '¿Cómo debe ordenarse la herramienta en el almacén?',
      '¿Qué equipo de protección debe verse en la foto?',
      '¿Cuáles son las señales de advertencia necesarias?'
    ];

    vi.mocked(callGeminiChatWithRetry).mockResolvedValue({
      text: JSON.stringify(mockQuestions),
      tokens: { input: 50, output: 50, total: 100 },
    });

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({ industry: 'Construcción Pesada' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toEqual(mockQuestions);
    
    expect(callGeminiChatWithRetry).toHaveBeenCalled();
    const callArgs = vi.mocked(callGeminiChatWithRetry).mock.calls[0];
    expect(callArgs[0]).toBe('gemini-3.5-flash');
    expect(callArgs[1]).toContain('preguntas guía hiper-específicas');
  });

  it('debe retornar FALLBACK_QUESTIONS si Gemini falla, está desconectado o lanza un error', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      clientId: 'cli-test',
      clientName: 'Test Client',
      email: 'test@example.com',
    } as any);

    vi.mocked(callGeminiChatWithRetry).mockRejectedValue(new Error('API Down'));

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({ industry: 'Aeropuertos' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(4);
    // Verificamos que contenga una de las de fallback
    expect(body.questions[0]).toContain('¿Cuáles son las áreas o zonas más importantes');
  });

  it('debe retornar FALLBACK_QUESTIONS si Gemini responde un JSON con formato incorrecto o incompleto', async () => {
    vi.mocked(requireOnboardingAuth).mockResolvedValue({
      clientId: 'cli-test',
      clientName: 'Test Client',
      email: 'test@example.com',
    } as any);

    // JSON no arreglo o arreglo con longitud diferente a 4
    vi.mocked(callGeminiChatWithRetry).mockResolvedValue({
      text: JSON.stringify(['Solo 1 pregunta']),
      tokens: { input: 50, output: 10, total: 60 },
    });

    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'POST',
      body: JSON.stringify({ industry: 'Hotelería' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(4);
    expect(body.questions[0]).toContain('¿Cuáles son las áreas o zonas más importantes');
  });
});

describe('GET /api/onboarding/guide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';
  });

  it('debe retornar mensaje de bienvenida si se llama GET sin parametro industry', async () => {
    const req = new NextRequest('http://localhost/api/onboarding/guide', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('Playground');
    expect(body.tip).toBeDefined();
  });

  it('debe retornar las 4 preguntas de Gemini si se provee ?industry=... con JSON valido', async () => {
    const mockQuestions = [
      '¿Hospital 1?',
      '¿Hospital 2?',
      '¿Hospital 3?',
      '¿Hospital 4?'
    ];

    vi.mocked(callGeminiChatWithRetry).mockResolvedValue({
      text: JSON.stringify(mockQuestions),
      tokens: { input: 10, output: 10, total: 20 },
    });

    const req = new NextRequest('http://localhost/api/onboarding/guide?industry=Clinicas', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toEqual(mockQuestions);
  });
});
