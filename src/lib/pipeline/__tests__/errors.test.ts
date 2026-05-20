import { describe, it, expect } from 'vitest';
import { classifyError } from '@/lib/pipeline/errors';

describe('classifyError', () => {
  it('429 → transient', () => {
    expect(classifyError(new Error('Gemini API error (429): rate')).kind).toBe('transient');
  });
  it('503 y 500 → transient', () => {
    expect(classifyError(new Error('Gemini API error (503): x')).kind).toBe('transient');
    expect(classifyError(new Error('Gemini API error (500): x')).kind).toBe('transient');
  });
  it('400 y 403 → permanent', () => {
    expect(classifyError(new Error('Gemini API error (400): bad')).kind).toBe('permanent');
    expect(classifyError(new Error('Gemini API error (403): denied')).kind).toBe('permanent');
  });
  it('no response text (single image) → safety_block', () => {
    expect(classifyError(new Error('No response text from Gemini')).kind).toBe('safety_block');
  });
  it('no response text (comparison, con sufijo) → safety_block', () => {
    // analyzeWithReferences lanza 'No response text from Gemini comparison'
    // (gemini.ts:~261). El match DEBE ser includes(), no ===.
    expect(classifyError(new Error('No response text from Gemini comparison')).kind).toBe('safety_block');
  });
  it('timeout/abort → transient', () => {
    const e = new Error('aborted'); e.name = 'AbortError';
    expect(classifyError(e).kind).toBe('transient');
  });
  it('error desconocido → permanent (no reintentar a ciegas)', () => {
    expect(classifyError(new Error('algo raro')).kind).toBe('permanent');
  });
});

describe('Retry decision logic', () => {
  it('should identify transient error as retryable', () => {
    const error = new Error('Gemini API error (429): Rate limit');
    const classification = classifyError(error);
    expect(classification.kind).toBe('transient');
  });

  it('should identify permanent error as non-retryable (unrecoverable)', () => {
    const error = new Error('Gemini API error (400): Bad request');
    const classification = classifyError(error);
    expect(classification.kind).toBe('permanent');
  });

  it('should identify safety block error as non-retryable (unrecoverable)', () => {
    const error = new Error('No response text from Gemini');
    const classification = classifyError(error);
    expect(classification.kind).toBe('safety_block');
  });

  it('should identify ubiqo auth error as non-retryable (unrecoverable ubiqo_auth)', () => {
    const error = new Error('Ubiqo token inválido o expirado (HTTP 401)');
    const classification = classifyError(error);
    expect(classification.kind).toBe('permanent');
    expect(classification.reason).toBe('ubiqo_auth');
  });
});

