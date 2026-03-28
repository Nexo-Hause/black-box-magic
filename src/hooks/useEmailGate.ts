'use client';

import { useState, useEffect, useCallback } from 'react';
import { COOKIE_NAME } from '@/lib/constants';

interface GateState {
  loading: boolean;
  email: string | null;
  error: string | null;
}

export function useEmailGate() {
  const [state, setState] = useState<GateState>({
    loading: true,
    email: null,
    error: null,
  });

  // Check cookie on mount
  useEffect(() => {
    fetch('/api/gate/check')
      .then(res => res.json())
      .then(data => {
        setState({
          loading: false,
          email: data.authenticated ? data.email : null,
          error: null,
        });
      })
      .catch(() => {
        setState({ loading: false, email: null, error: null });
      });
  }, []);

  // Submit email
  const submitEmail = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setState({ loading: false, email: data.email, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  // Clear session ("not you?" link) — server-side cookie deletion
  const clearSession = useCallback(async () => {
    try {
      await fetch('/api/gate/logout', { method: 'POST' });
    } catch {
      // Best-effort — even if the call fails, clear local state
    }
    setState({ loading: false, email: null, error: null });
  }, []);

  return { ...state, submitEmail, clearSession };
}
