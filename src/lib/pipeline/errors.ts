/**
 * Error classification for Gemini and Ubiqo API errors.
 */

export interface ClassifiedError {
  kind: 'transient' | 'permanent' | 'safety_block';
  reason: string;
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  // 1. Check for Ubiqo Authentication Errors (Task 3 / Runbook)
  if (name === 'UbiqoAuthError' || message.includes('Ubiqo token') || message.includes('UBIQO_AUTH_FAILURE')) {
    return {
      kind: 'permanent',
      reason: 'ubiqo_auth',
    };
  }

  // 2. Safety block (Gemini filtering)
  if (message.includes('No response text from Gemini')) {
    return {
      kind: 'safety_block',
      reason: 'safety_block',
    };
  }

  // 3. Timeout or Network issues
  if (
    name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('network')
  ) {
    return {
      kind: 'transient',
      reason: 'timeout_or_network',
    };
  }

  // 4. Parse Gemini API error format: Gemini API error (STATUS): BODY
  const apiErrorMatch = message.match(/Gemini API error \((\d+)\)/);
  if (apiErrorMatch) {
    const status = parseInt(apiErrorMatch[1], 10);
    if (status === 429) {
      return {
        kind: 'transient',
        reason: 'rate_limit',
      };
    }
    if (status === 500 || status === 503) {
      return {
        kind: 'transient',
        reason: 'server_error',
      };
    }
    if (status === 400) {
      return {
        kind: 'permanent',
        reason: 'bad_request',
      };
    }
    if (status === 401 || status === 403) {
      return {
        kind: 'permanent',
        reason: 'auth_error',
      };
    }
  }

  // 5. JSON parsing errors or model response extraction errors
  if (
    message.includes('JSON') ||
    message.includes('Unexpected token') ||
    message.includes('extract valid JSON')
  ) {
    return {
      kind: 'permanent',
      reason: 'invalid_json',
    };
  }

  // Default unknown errors should be permanent to avoid infinite retry costs
  return {
    kind: 'permanent',
    reason: 'unknown',
  };
}
