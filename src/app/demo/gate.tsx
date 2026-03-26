'use client';

import { useState, FormEvent } from 'react';

interface GateScreenProps {
  onSubmit: (email: string) => Promise<void>;
  error: string | null;
  loading: boolean;
}

export function GateScreen({ onSubmit, error, loading }: GateScreenProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) onSubmit(email.trim());
  };

  return (
    <div className="gate-container">
      <div className="gate-card">
        <h1 className="gate-title">BLACK BOX MAGIC</h1>
        <p className="gate-subtitle">Auditoría visual de punto de venta con IA</p>

        <form onSubmit={handleSubmit} className="gate-form">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="gate-input"
            required
            autoFocus
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn--primary gate-btn"
            disabled={loading || !email.trim()}
          >
            {loading ? 'CARGANDO...' : 'ENTRAR'}
          </button>
        </form>

        {error && <p className="gate-error">{error}</p>}

        <p className="gate-notice">
          Al ingresar, aceptas que guardemos tu correo y datos de uso para mejorar el servicio.
        </p>
      </div>
    </div>
  );
}
