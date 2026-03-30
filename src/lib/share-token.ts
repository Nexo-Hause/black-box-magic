/**
 * Share Token — Genera tokens de corta duración para links compartibles.
 * Los tokens son UUIDs almacenados en Supabase con TTL.
 * Si Supabase no está disponible, genera tokens HMAC-signed (como las cookies).
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase';

const TOKEN_TTL_HOURS = 48;
const MAX_USES_PER_TOKEN = 10;
const SHARE_SECRET = process.env.BBM_COOKIE_SECRET;

export interface ShareTokenPayload {
  email: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Genera un share token. Si Supabase está disponible, lo almacena en DB.
 * Siempre incluye firma HMAC para validación sin DB.
 *
 * Formato del token: uuid.hmac (el HMAC permite validar integridad)
 */
export async function generateShareToken(email: string): Promise<string> {
  if (!SHARE_SECRET || SHARE_SECRET.length < 32) {
    throw new Error('BBM_COOKIE_SECRET no configurado — no se pueden generar share tokens');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  const token = randomUUID();

  if (supabase) {
    try {
      const { error } = await supabase.from('bbm_share_tokens').insert({
        token,
        email,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      });
      if (error) {
        console.error('Error al insertar share token en Supabase:', error.message);
      }
    } catch (e) {
      console.error('Excepción al insertar share token:', e);
    }
  }

  // Token firmado: uuid.hmac — el HMAC vincula token+email+expiración
  const hmac = createHmac('sha256', SHARE_SECRET)
    .update(`${token}:${email}:${expiresAt.toISOString()}`)
    .digest('hex')
    .slice(0, 16);

  return `${token}.${hmac}`;
}

/**
 * Valida un share token. Retorna el email si es válido, null si inválido/expirado.
 *
 * Flujo:
 * 1. Si Supabase está disponible, valida contra la DB (expiry + rate limit)
 * 2. Si no hay Supabase, no se puede validar (los tokens requieren estado)
 */
export async function validateShareToken(tokenString: string): Promise<string | null> {
  const parts = tokenString.split('.');
  if (parts.length !== 2) return null;

  const [uuid, hmac] = parts;

  // Validar formato UUID básico
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return null;
  }

  // Validar formato HMAC (16 chars hex)
  if (!/^[0-9a-f]{16}$/i.test(hmac)) {
    return null;
  }

  // Requiere Supabase para validación con estado (expiry, rate limit)
  if (!supabase) {
    console.warn('Share token recibido pero Supabase no está configurado — no se puede validar');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('bbm_share_tokens')
      .select('email, expires_at, used_count')
      .eq('token', uuid)
      .single();

    if (error || !data) return null;

    // Verificar expiración
    const now = new Date();
    if (new Date(data.expires_at) < now) return null;

    // Rate limit: máximo MAX_USES_PER_TOKEN usos por token
    const usedCount = data.used_count || 0;
    if (usedCount >= MAX_USES_PER_TOKEN) return null;

    // Verificar HMAC para garantizar integridad del token
    if (!SHARE_SECRET || SHARE_SECRET.length < 32) return null;

    const expectedHmac = createHmac('sha256', SHARE_SECRET)
      .update(`${uuid}:${data.email}:${data.expires_at}`)
      .digest('hex')
      .slice(0, 16);

    const hmacBuf = Buffer.from(hmac, 'utf8');
    const expectedBuf = Buffer.from(expectedHmac, 'utf8');
    if (hmacBuf.length !== expectedBuf.length || !timingSafeEqual(hmacBuf, expectedBuf)) {
      return null;
    }

    // Incrementar contador de uso
    await supabase
      .from('bbm_share_tokens')
      .update({
        used_count: usedCount + 1,
        last_used_at: now.toISOString(),
      })
      .eq('token', uuid);

    return data.email;
  } catch (e) {
    console.error('Error al validar share token:', e);
    return null;
  }
}
