/**
 * Tipos canónicos de tenencia multi-tenant.
 * Diseño: docs/tenancy-model.md
 */

export type TenantRole = 'bbm_admin' | 'reseller_admin' | 'client_user';

export interface TenantSession {
  email: string;
  role: TenantRole;
  accountId: string | null;   // null sólo para bbm_admin
  clientId: string | null;    // set sólo para client_user
}

/**
 * Opciones opcionales para el helper de scoping.
 * requestedClientId: el clientId enviado en la querystring (selector del dashboard).
 * requestedAccountId: el accountId enviado en la querystring (solo bbm_admin).
 */
export interface ScopeOptions {
  requestedClientId?: string;
  requestedAccountId?: string;
}
