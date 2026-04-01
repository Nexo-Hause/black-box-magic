'use client';

import { useState, FormEvent, useCallback } from 'react';
import { useAdminGate } from '@/hooks/useAdminGate';
import { GateScreen } from '@/app/demo/gate';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratedLink {
  id: string;
  clientId: string;
  clientName: string;
  email: string;
  url: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const gate = useAdminGate();

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientIdEdited, setClientIdEdited] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<GeneratedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Auto-generate clientId from name
  const handleNameChange = useCallback((value: string) => {
    setClientName(value);
    if (!clientIdEdited) {
      setClientId(toKebabCase(value));
    }
  }, [clientIdEdited]);

  const handleClientIdChange = useCallback((value: string) => {
    setClientId(value);
    setClientIdEdited(true);
  }, []);

  // Generate link
  const handleGenerate = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !clientId.trim()) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/onboarding-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientName: clientName.trim(),
          email: clientEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar link');

      const link: GeneratedLink = {
        id: data.code,
        clientId: clientId.trim(),
        clientName: clientName.trim(),
        email: clientEmail.trim(),
        url: data.url,
        createdAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      };
      setLinks(prev => [link, ...prev]);

      // Reset form
      setClientName('');
      setClientEmail('');
      setClientId('');
      setClientIdEdited(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGenerating(false);
    }
  }, [clientName, clientEmail, clientId]);

  // Copy to clipboard
  const handleCopy = useCallback(async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for non-HTTPS
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (gate.loading) {
    return (
      <div className="gate-container">
        <div className="gate-card" style={{ textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // ─── Gate ────────────────────────────────────────────────────────────────

  if (!gate.email || !gate.authorized) {
    return (
      <>
        <GateScreen
          onSubmit={gate.submitEmail}
          error={gate.error}
          loading={gate.loading}
        />
        {gate.email && !gate.authorized && (
          <div className="gate-container" style={{ marginTop: '-2rem' }}>
            <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <p style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                Solo administradores pueden acceder a esta página.
              </p>
              <button
                className="btn btn--secondary btn--small"
                onClick={gate.clearSession}
                style={{ marginTop: '0.75rem' }}
              >
                INTENTAR CON OTRO EMAIL
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ─── Admin Panel ─────────────────────────────────────────────────────────

  const clientIdValid = /^[a-zA-Z0-9_-]+$/.test(clientId.trim());

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div className="user-bar" style={{ marginBottom: '1.5rem' }}>
        <span className="user-bar__email">{gate.email}</span>
        <button className="user-bar__logout" onClick={gate.clearSession}>
          Salir
        </button>
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
        ADMIN
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Genera links de onboarding para clientes de prueba
      </p>

      {/* Form */}
      <form onSubmit={handleGenerate} className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label htmlFor="clientName" className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Nombre del cliente
            </label>
            <input
              id="clientName"
              type="text"
              value={clientName}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Fruit of the Loom"
              className="gate-input"
              required
              disabled={generating}
            />
          </div>

          <div>
            <label htmlFor="clientEmail" className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Email del cliente
            </label>
            <input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="carlos@fotl.com"
              className="gate-input"
              required
              disabled={generating}
            />
          </div>

          <div>
            <label htmlFor="clientId" className="text-sm" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              Client ID
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                auto-generado, editable
              </span>
            </label>
            <input
              id="clientId"
              type="text"
              value={clientId}
              onChange={e => handleClientIdChange(e.target.value)}
              placeholder="fruit-of-the-loom"
              className="gate-input mono"
              required
              disabled={generating}
              style={{ fontSize: '0.85rem' }}
            />
            {clientId && !clientIdValid && (
              <p className="text-xs" style={{ color: 'var(--accent-red)', marginTop: '0.25rem' }}>
                Solo letras, numeros, guiones y guiones bajos
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={generating || !clientName.trim() || !clientEmail.trim() || !clientId.trim() || !clientIdValid}
            style={{ marginTop: '0.25rem' }}
          >
            {generating ? 'GENERANDO...' : 'GENERAR LINK'}
          </button>
        </div>

        {error && (
          <p className="gate-error" style={{ marginTop: '0.75rem' }}>{error}</p>
        )}
      </form>

      {/* Generated links */}
      {links.length > 0 && (
        <div>
          <h2 className="text-sm" style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            Links generados ({links.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {links.map(link => (
              <div key={link.id} className="card card--subtle">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{link.clientName}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {link.email}
                    </span>
                  </div>
                  <span className="badge badge--blue">Expira en 7 dias</span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  background: 'var(--bg)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                }}>
                  <code className="text-xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {link.url}
                  </code>
                  <button
                    className="btn btn--small"
                    onClick={() => handleCopy(link.url, link.id)}
                    style={{ flexShrink: 0 }}
                  >
                    {copied === link.id ? 'COPIADO' : 'COPIAR'}
                  </button>
                </div>

                <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  <span className="mono">{link.clientId}</span>
                  <span style={{ marginLeft: '0.75rem' }}>{link.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
