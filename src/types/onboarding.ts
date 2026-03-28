// ─── Onboarding API Contracts — Zod v4 schemas ───────────────────────────────
import { z } from 'zod/v4';

// ─── Code Exchange ───────────────────────────────────────────────────────────
export const exchangeCodeRequestSchema = z.object({
  code: z.string().uuid(),
});
export type ExchangeCodeRequest = z.infer<typeof exchangeCodeRequestSchema>;

// ─── Session ─────────────────────────────────────────────────────────────────
export const createSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string(),
  clientName: z.string(),
  token: z.string(), // JWT
});
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(1000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(1000),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  response: z.string(),
  toolCalls: z.array(z.object({
    name: z.string(),
    args: z.record(z.string(), z.unknown()),
  })).optional(),
  isComplete: z.boolean(),
  turnCount: z.number(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

// ─── Synthesize ───────────────────────────────────────────────────────────────
export const synthesizeRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>;

export const synthesizeResponseSchema = z.object({
  config: z.record(z.string(), z.unknown()), // validated separately with clientConfigSchema
  gaps: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type SynthesizeResponse = z.infer<typeof synthesizeResponseSchema>;

// ─── Onboarding Token Payload ─────────────────────────────────────────────────
export const onboardingTokenPayloadSchema = z.object({
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  email: z.string().email(),
});
export type OnboardingTokenPayload = z.infer<typeof onboardingTokenPayloadSchema>;
