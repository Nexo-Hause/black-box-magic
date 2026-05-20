/**
 * Resolución de sesión multi-tenant.
 * Reemplaza DASHBOARD_ALLOWED_EMAILS por lookup en bbm_users.
 * Diseño: docs/tenancy-model.md §5, spec/04-ws-mt-multitenant.md Tarea 2.
 */

import type { TenantSession } from '@/lib/tenant/types';

/**
 * Resuelve la identidad, rol y scope de un usuario a partir de su email.
 * Consulta la tabla bbm_users por email (lowercased).
 *
 * @returns TenantSession si el email tiene fila; null si no existe (→ 403 upstream).
 */
export async function resolveSession(
  email: string,
  supabase: any
): Promise<TenantSession | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: userRow, error } = await supabase
    .from('bbm_users')
    .select('email, role, account_id, client_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error || !userRow) {
    return null;
  }

  return {
    email: userRow.email,
    role: userRow.role,
    accountId: userRow.account_id ?? null,
    clientId: userRow.client_id ?? null,
  };
}
