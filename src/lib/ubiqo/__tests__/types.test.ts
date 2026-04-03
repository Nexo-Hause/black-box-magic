/**
 * Ubiqo types — Zod schema validation tests
 *
 * Tests ingestRequestSchema against valid and invalid inputs.
 */

import { describe, it, expect } from 'vitest';
import { ingestRequestSchema } from '@/lib/ubiqo/types';

describe('ingestRequestSchema', () => {
  it('validates correct input', () => {
    const input = {
      form_id: 30143,
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.form_id).toBe(30143);
      expect(result.data.from).toBe('20260317000000');
      expect(result.data.to).toBe('20260318000000');
    }
  });

  it('validates input with optional tz field', () => {
    const input = {
      form_id: 30143,
      from: '20260317000000',
      to: '20260318000000',
      tz: 'America/Mexico_City',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tz).toBe('America/Mexico_City');
    }
  });

  it('accepts input without tz field (optional)', () => {
    const input = {
      form_id: 30143,
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tz).toBeUndefined();
    }
  });

  it('rejects negative form_id', () => {
    const input = {
      form_id: -1,
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects zero form_id', () => {
    const input = {
      form_id: 0,
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects string form_id', () => {
    const input = {
      form_id: 'abc',
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects float form_id', () => {
    const input = {
      form_id: 30143.5,
      from: '20260317000000',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects from with fewer than 14 digits', () => {
    const input = {
      form_id: 30143,
      from: '2026031700',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects from with more than 14 digits', () => {
    const input = {
      form_id: 30143,
      from: '202603170000001',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects from with non-digit characters', () => {
    const input = {
      form_id: 30143,
      from: '2026-03-17T00:',
      to: '20260318000000',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects to with invalid format', () => {
    const input = {
      form_id: 30143,
      from: '20260317000000',
      to: 'not-a-timestamp',
    };

    const result = ingestRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
