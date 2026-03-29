import { describe, it, expect, vi, beforeAll } from 'vitest';
import { formatTranscriptForSynthesis, synthesizeConfig } from '../synthesis';
import { createEmptyPartialConfig } from '../tools';
import type { ChatMessage } from '@/lib/gemini-chat';

// ─── Mock gemini-chat ─────────────────────────────────────────────────────────

vi.mock('@/lib/gemini-chat', () => ({
  callGeminiChatWithRetry: vi.fn(),
  SYNTHESIS_MODEL: 'test-model',
}));

import { callGeminiChatWithRetry } from '@/lib/gemini-chat';
const mockGemini = vi.mocked(callGeminiChatWithRetry);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validConfigFixture = {
  clientId: 'test-client',
  clientName: 'Test Client',
  industry: 'qsr',
  evaluationAreas: [
    {
      id: 'area-1',
      name: 'Test Area',
      description: 'Test',
      weight: 1.0,
      criteria: [
        {
          id: 'c1',
          name: 'Criterion One',
          type: 'binary',
          description: 'Test criterion',
          weight: 0.5,
          critical: false,
        },
        {
          id: 'c2',
          name: 'Criterion Two',
          type: 'presence',
          description: 'Another test criterion',
          weight: 0.5,
          critical: false,
        },
      ],
    },
  ],
  globalScoringMethod: 'weighted',
  passingScore: 70,
  escalationRules: [
    {
      id: 'rule-1',
      trigger: { type: 'global_score_below', threshold: 60 },
      severity: 'high',
      action: 'flag',
      description: 'Score global por debajo del mínimo',
    },
  ],
  industryContext: 'Test context',
  customInstructions: '',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const clientInfo = {
  clientId: 'test-client',
  clientName: 'Test Client',
  email: 'test@example.com',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.GOOGLE_AI_API_KEY = 'test-key';
});

// ─── formatTranscriptForSynthesis ─────────────────────────────────────────────

describe('formatTranscriptForSynthesis', () => {
  it('formats user and model messages correctly', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        parts: [{ text: 'Hola, somos una cadena de comida rápida.' }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido, ¿cuántas sucursales tienen?' }],
      },
    ];

    const result = formatTranscriptForSynthesis(messages);

    expect(result).toContain('Usuario: Hola, somos una cadena de comida rápida.');
    expect(result).toContain('Asistente: Entendido, ¿cuántas sucursales tienen?');
  });

  it('shows function calls as "→ Se registró: name(...)"', () => {
    const messages: ChatMessage[] = [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'setIndustry',
              args: { industry: 'qsr', description: 'Cadena de comida rápida' },
            },
          },
        ],
      },
    ];

    const result = formatTranscriptForSynthesis(messages);

    expect(result).toContain('→ Se registró: setIndustry(');
    expect(result).toContain('"qsr"');
  });

  it('omits functionResponse parts from the transcript', () => {
    const messages: ChatMessage[] = [
      {
        role: 'model',
        parts: [
          {
            functionResponse: {
              name: 'setIndustry',
              response: { ok: true },
            },
          },
        ],
      },
    ];

    const result = formatTranscriptForSynthesis(messages);
    expect(result).toBe('');
  });
});

// ─── synthesizeConfig ─────────────────────────────────────────────────────────

describe('synthesizeConfig', () => {
  it('returns a valid config when Gemini returns good JSON', async () => {
    const synthesisResponse = {
      config: validConfigFixture,
      gaps: [],
      confidence: 0.9,
    };

    mockGemini.mockResolvedValueOnce({
      text: JSON.stringify(synthesisResponse),
      tokens: { input: 100, output: 200, total: 300 },
    });

    const result = await synthesizeConfig(
      [],
      createEmptyPartialConfig(),
      clientInfo,
    );

    expect(result.config).toBeDefined();
    expect(result.config.clientId).toBe(clientInfo.clientId);
    expect(result.config.clientName).toBe(clientInfo.clientName);
    expect(result.config.industry).toBe('qsr');
    expect(result.gaps).toEqual([]);
    expect(result.confidence).toBe(0.9);
  });

  it('returns gaps when config has validation issues', async () => {
    // Config missing required fields — evaluationAreas is empty (fails min(1))
    const incompleteConfig = {
      ...validConfigFixture,
      evaluationAreas: [], // violates min(1)
    };

    const synthesisResponse = {
      config: incompleteConfig,
      gaps: ['No se identificaron áreas de evaluación'],
      confidence: 0.2,
    };

    mockGemini.mockResolvedValueOnce({
      text: JSON.stringify(synthesisResponse),
      tokens: { input: 100, output: 50, total: 150 },
    });

    const result = await synthesizeConfig(
      [],
      createEmptyPartialConfig(),
      clientInfo,
    );

    // Zod validation should fail → gaps array should be non-empty and confidence = 0
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.confidence).toBe(0);
  });

  it('fills in metadata (clientId, clientName, version, timestamps) from clientInfo', async () => {
    // Return a config with different clientId/clientName to confirm overwrite
    const configWithWrongMeta = {
      ...validConfigFixture,
      clientId: 'gemini-provided-id',
      clientName: 'Gemini Provided Name',
      version: 99,
    };

    const synthesisResponse = {
      config: configWithWrongMeta,
      gaps: [],
      confidence: 0.85,
    };

    mockGemini.mockResolvedValueOnce({
      text: JSON.stringify(synthesisResponse),
      tokens: { input: 100, output: 200, total: 300 },
    });

    const result = await synthesizeConfig(
      [],
      createEmptyPartialConfig(),
      clientInfo,
    );

    // Metadata must come from clientInfo, not from Gemini's output
    expect(result.config.clientId).toBe(clientInfo.clientId);
    expect(result.config.clientName).toBe(clientInfo.clientName);
    expect(result.config.version).toBe(1);
    // Timestamps should be ISO strings set at call time
    expect(result.config.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.config.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws when Gemini returns no text', async () => {
    mockGemini.mockResolvedValueOnce({
      text: undefined,
      tokens: { input: 0, output: 0, total: 0 },
    });

    await expect(
      synthesizeConfig([], createEmptyPartialConfig(), clientInfo),
    ).rejects.toThrow();
  });

  it('throws when Gemini returns invalid JSON', async () => {
    mockGemini.mockResolvedValueOnce({
      text: 'this is not json at all',
      tokens: { input: 0, output: 0, total: 0 },
    });

    await expect(
      synthesizeConfig([], createEmptyPartialConfig(), clientInfo),
    ).rejects.toThrow(/JSON inválido/);
  });

  it('throws when Gemini response is missing expected keys', async () => {
    mockGemini.mockResolvedValueOnce({
      text: JSON.stringify({ unexpected: true }),
      tokens: { input: 0, output: 0, total: 0 },
    });

    await expect(
      synthesizeConfig([], createEmptyPartialConfig(), clientInfo),
    ).rejects.toThrow(/campos esperados/);
  });

  it('strips markdown code fences before parsing JSON', async () => {
    const synthesisResponse = {
      config: validConfigFixture,
      gaps: [],
      confidence: 0.8,
    };

    const withFences = `\`\`\`json\n${JSON.stringify(synthesisResponse)}\n\`\`\``;

    mockGemini.mockResolvedValueOnce({
      text: withFences,
      tokens: { input: 100, output: 200, total: 300 },
    });

    const result = await synthesizeConfig(
      [],
      createEmptyPartialConfig(),
      clientInfo,
    );

    expect(result.config).toBeDefined();
    expect(result.config.industry).toBe('qsr');
  });
});
