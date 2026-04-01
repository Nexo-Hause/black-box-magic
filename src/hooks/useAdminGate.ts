'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminGateState {
  loading: boolean;
  email: string | null;
  authorized: boolean;
  error: string | null;
}

export function useAdminGate() {
  const [state, setState] = useState<AdminGateState>({
    loading: true,
    email: null,
    authorized: false,
    error: null,
  });

  // Check admin cookie on mount
  useEffect(() => {
    fetch('/api/admin/gate/check')
      .then(res => res.json())
      .then(data => {
        setState({
          loading: false,
          email: data.authenticated ? data.email : null,
          authorized: data.authorized ?? false,
          error: null,
        });
      })
      .catch(() => {
        setState({ loading: false, email: null, authorized: false, error: 'Error de conexión' });
      });
  }, []);

  // Submit email for admin auth
  const submitEmail = useCallback(async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/admin/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Acceso denegado');
      setState({ loading: false, email: data.email, authorized: true, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setState(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  // Logout
  const clearSession = useCallback(async () => {
    try {
      await fetch('/api/admin/gate/logout', { method: 'POST' });
    } catch {
      // Best-effort
    }
    setState({ loading: false, email: null, authorized: false, error: null });
  }, []);

  return { ...state, submitEmail, clearSession };
}
