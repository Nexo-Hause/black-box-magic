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
      .then(res => {
        if (!res.ok) return { authenticated: false };
        return res.json();
      })
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
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status})`);
      }
      if (!res.ok) throw new Error((data.error as string) || 'Failed');
      setState({ loading: false, email: data.email as string, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  // Clear session ("not you?" link)
  const clearSession = useCallback(async () => {
    // Delete cookie by setting it expired
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    setState({ loading: false, email: null, error: null });
  }, []);

  return { ...state, submitEmail, clearSession };
}
