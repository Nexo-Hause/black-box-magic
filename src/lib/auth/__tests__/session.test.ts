import { describe, it, expect, vi } from 'vitest';
import { resolveSession } from '@/lib/auth/session';

function supaWith(userRow: any) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: userRow, error: null })),
        })),
      })),
    })),
  } as any;
}

function supaWithError() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: { message: 'db error' } })),
        })),
      })),
    })),
  } as any;
}

describe('resolveSession', () => {
  it('email sin fila en bbm_users → null (403 upstream)', async () => {
    const s = await resolveSession('ghost@x.com', supaWith(null));
    expect(s).toBeNull();
  });

  it('client_user → scope a su client_id y account_id', async () => {
    const s = await resolveSession('carlos@fotl.com', supaWith({
      email: 'carlos@fotl.com',
      role: 'client_user',
      account_id: 'a1',
      client_id: 'c1',
    }));
    expect(s).toEqual({
      email: 'carlos@fotl.com',
      role: 'client_user',
      accountId: 'a1',
      clientId: 'c1',
    });
  });

  it('reseller_admin → scope a su account_id, sin client_id', async () => {
    const s = await resolveSession('enrique@ubiqo.com', supaWith({
      email: 'enrique@ubiqo.com',
      role: 'reseller_admin',
      account_id: 'a1',
      client_id: null,
    }));
    expect(s).toEqual({
      email: 'enrique@ubiqo.com',
      role: 'reseller_admin',
      accountId: 'a1',
      clientId: null,
    });
  });

  it('bbm_admin → sin scope (ve todo)', async () => {
    const s = await resolveSession('gonzalo@x.com', supaWith({
      email: 'gonzalo@x.com',
      role: 'bbm_admin',
      account_id: null,
      client_id: null,
    }));
    expect(s).toEqual({
      email: 'gonzalo@x.com',
      role: 'bbm_admin',
      accountId: null,
      clientId: null,
    });
  });

  it('normaliza el email a lowercase antes de buscar', async () => {
    const eqSpy = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: { email: 'test@x.com', role: 'bbm_admin', account_id: null, client_id: null },
        error: null,
      })),
    }));

    const mockSupa = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: eqSpy,
        })),
      })),
    } as any;

    await resolveSession('TEST@X.COM', mockSupa);

    // Verificar que se llamó .eq con email en lowercase
    expect(eqSpy).toHaveBeenCalledWith('email', 'test@x.com');
  });

  it('error de base de datos → null', async () => {
    const s = await resolveSession('any@x.com', supaWithError());
    expect(s).toBeNull();
  });
});
