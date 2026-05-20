import { describe, it, expect, vi } from 'vitest';
import { scopedQuery } from '@/lib/tenant/scope';
import type { TenantSession } from '@/lib/tenant/types';

function fakeBuilder() {
  const calls: any[] = [];
  const b: any = {
    eq: vi.fn((c: string, v: any) => { calls.push(['eq', c, v]); return b; }),
    _calls: calls,
  };
  return b;
}

const admin: TenantSession = { email: 'a@x.com', role: 'bbm_admin', accountId: null, clientId: null };
const reseller: TenantSession = { email: 'r@x.com', role: 'reseller_admin', accountId: 'acc1', clientId: null };
const client: TenantSession = { email: 'c@x.com', role: 'client_user', accountId: 'acc1', clientId: 'cli1' };

describe('scopedQuery — aislamiento multi-tenant', () => {
  it('client_user fuerza client_id propio (ignora clientId del request)', () => {
    const b = fakeBuilder();
    scopedQuery(b, client, { requestedClientId: 'OTRO' });
    expect(b._calls).toContainEqual(['eq', 'client_id', 'cli1']);
    expect(b._calls).not.toContainEqual(['eq', 'client_id', 'OTRO']);
  });

  it('client_user aplica exactamente 1 filtro (solo client_id)', () => {
    const b = fakeBuilder();
    scopedQuery(b, client, {});
    expect(b._calls).toHaveLength(1);
    expect(b._calls[0]).toEqual(['eq', 'client_id', 'cli1']);
  });

  it('reseller_admin filtra por account_id; clientId opcional dentro de su cuenta', () => {
    const b = fakeBuilder();
    scopedQuery(b, reseller, { requestedClientId: 'cliX' });
    expect(b._calls).toContainEqual(['eq', 'account_id', 'acc1']);
    expect(b._calls).toContainEqual(['eq', 'client_id', 'cliX']);
  });

  it('reseller_admin sin clientId solo filtra por account_id', () => {
    const b = fakeBuilder();
    scopedQuery(b, reseller, {});
    expect(b._calls).toHaveLength(1);
    expect(b._calls[0]).toEqual(['eq', 'account_id', 'acc1']);
  });

  it('reseller_admin: account_id del token SIEMPRE presente aunque pida clientId de otra cuenta', () => {
    const b = fakeBuilder();
    scopedQuery(b, reseller, { requestedClientId: 'cli-de-OTRA-cuenta' });
    // el account_id del token gana siempre: account_id=acc1 + client_id ajeno
    // → la query devuelve 0 filas (no leak). Un refactor que quite este eq es bug.
    expect(b._calls).toContainEqual(['eq', 'account_id', 'acc1']);
  });

  it('bbm_admin sin filtro de tenencia', () => {
    const b = fakeBuilder();
    scopedQuery(b, admin, {});
    expect(b._calls).toHaveLength(0);
  });

  it('bbm_admin con filtros opcionales los aplica', () => {
    const b = fakeBuilder();
    scopedQuery(b, admin, { requestedAccountId: 'accX', requestedClientId: 'cliY' });
    expect(b._calls).toContainEqual(['eq', 'account_id', 'accX']);
    expect(b._calls).toContainEqual(['eq', 'client_id', 'cliY']);
  });

  it('devuelve el builder para encadenamiento', () => {
    const b = fakeBuilder();
    const result = scopedQuery(b, admin, {});
    expect(result).toBe(b);
  });
});
