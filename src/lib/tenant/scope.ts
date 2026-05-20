/**
 * Helper centralizado de scoping multi-tenant.
 * TODA lectura del dashboard DEBE pasar por scopedQuery.
 * Diseño: docs/tenancy-model.md §5, spec/04-ws-mt-multitenant.md Tarea 3.
 *
 * Enforcement primario = app-layer (este helper).
 * RLS en PostgreSQL es defensa en profundidad (service-role la bypasea).
 */

import type { TenantSession, ScopeOptions } from '@/lib/tenant/types';

/**
 * Aplica filtros de tenencia al query builder de Supabase según el rol
 * del usuario autenticado. Devuelve el builder para encadenamiento.
 *
 * Reglas:
 * - client_user: SIEMPRE filtra por session.clientId. Ignora requestedClientId.
 * - reseller_admin: SIEMPRE filtra por session.accountId. Si requestedClientId
 *   está set, también filtra por client_id (dentro de su cuenta).
 * - bbm_admin: sin restricción de seguridad. Si requestedClientId o
 *   requestedAccountId están set, los aplica como filtros opcionales.
 */
export function scopedQuery<T>(
  builder: T,
  session: TenantSession,
  opts: ScopeOptions
): T {
  const b = builder as any;

  switch (session.role) {
    case 'client_user':
      // Fuerza su propio client_id. Ignora cualquier requestedClientId del request.
      b.eq('client_id', session.clientId);
      break;

    case 'reseller_admin':
      // Siempre filtra por su cuenta (previene leak cross-account)
      b.eq('account_id', session.accountId);
      // Opcionalmente filtra dentro de su cuenta por un cliente específico
      if (opts.requestedClientId) {
        b.eq('client_id', opts.requestedClientId);
      }
      break;

    case 'bbm_admin':
      // Sin restricción de seguridad — filtros opcionales del dashboard
      if (opts.requestedAccountId) {
        b.eq('account_id', opts.requestedAccountId);
      }
      if (opts.requestedClientId) {
        b.eq('client_id', opts.requestedClientId);
      }
      break;
  }

  return builder;
}
