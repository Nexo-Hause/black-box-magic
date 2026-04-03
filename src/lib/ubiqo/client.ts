/**
 * Ubiqo API client — fetches captures from Evidence/Gather API
 *
 * Ref: docs/ubiqo/api-validation-2026-03-31.md
 * Ref: spec/00-ubiqo-integration.md
 */

import type { UbiqoCaptura, UbiqoFotografia, UbiqoPhoto } from './types';

// ─── Config helpers ─────────────────────────────────────────────────────────

const DEFAULT_BASE = 'https://bi.ubiqo.net';
const FETCH_TIMEOUT_MS = 30_000;
const MAX_API_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function getApiToken(): string {
  const token = process.env.UBIQO_API_TOKEN;
  if (!token) {
    throw new Error('UBIQO_API_TOKEN environment variable is not set');
  }
  return token;
}

function getApiBase(): string {
  return process.env.UBIQO_API_BASE || DEFAULT_BASE;
}

/**
 * Fetch with automatic retry on HTTP 429 (rate limit) or 503 (service unavailable).
 * Respects Retry-After header when present; otherwise uses exponential backoff.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_API_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);

    if ((response.status === 429 || response.status === 503) && attempt < retries) {
      const retryAfterRaw = response.headers.get('Retry-After');
      const delayMs = retryAfterRaw
        ? parseInt(retryAfterRaw, 10) * 1000
        : RETRY_BASE_DELAY_MS * Math.pow(2, attempt); // exponential backoff

      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }

    return response;
  }

  // Unreachable, but satisfies TypeScript
  throw new Error(`Ubiqo API fetch failed after ${retries} retries`);
}

// ─── fetchCaptures ──────────────────────────────────────────────────────────

/**
 * Fetch captures from Ubiqo Evidence API for a given form and time range.
 *
 * @param formId  - Ubiqo form ID (e.g. 30143)
 * @param from    - Start timestamp in YYYYMMDDHHmmss format
 * @param to      - End timestamp in YYYYMMDDHHmmss format
 * @param tz      - Optional IANA timezone (e.g. "America/Mexico_City")
 * @returns Array of captures with metadata, fields, and photos
 */
export async function fetchCaptures(
  formId: number,
  from: string,
  to: string,
  tz?: string
): Promise<UbiqoCaptura[]> {
  const token = getApiToken();
  const base = getApiBase();

  const url = new URL(`/v1/Capturas/Rango/${formId}/${from}/${to}`, base);
  if (tz) {
    url.searchParams.set('tz', tz);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ubiqo API error: ${response.status} ${response.statusText}`
      );
    }

    const data: UbiqoCaptura[] = await response.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── buildPhotoUrl ──────────────────────────────────────────────────────────

/**
 * Build the full download URL for a photo.
 * URL = urlBase + foto.url + firma (3 parts per Phase 0 validation)
 *
 * SECURITY: The resulting URL contains a CloudFront signed token (firma).
 * Do NOT log, cache, or expose this URL in error messages or client responses.
 *
 * @param captura - Parent capture (provides urlBase and firma)
 * @param foto    - Photo object (provides relative url path)
 * @returns Full CloudFront URL with signed query params
 */
export function buildPhotoUrl(
  captura: Pick<UbiqoCaptura, 'urlBase' | 'firma'>,
  foto: Pick<UbiqoFotografia, 'url'>
): string {
  return captura.urlBase + foto.url + captura.firma;
}

// ─── extractPhotos ──────────────────────────────────────────────────────────

/**
 * Extract all photos from a capture, flattening gallery fields (idTipo=7)
 * into UbiqoPhoto objects enriched with parent capture metadata.
 *
 * Only idTipo=7 (gallery) fields contain photos in the real API data.
 *
 * @param captura - A single Ubiqo capture
 * @returns Flattened array of photos with parent metadata
 */
export function extractPhotos(captura: UbiqoCaptura): UbiqoPhoto[] {
  const photos: UbiqoPhoto[] = [];

  for (const campo of captura.capturas) {
    // Only gallery fields (idTipo=7) have photos
    if (campo.idTipo !== 7) continue;
    if (!campo.fotografias || campo.fotografias.length === 0) continue;

    for (const foto of campo.fotografias) {
      // Skip entries with no URL (defensive)
      if (!foto.url) continue;

      photos.push({
        // Photo fields
        url: foto.url,
        latitud: foto.latitud,
        longitud: foto.longitud,
        tieneCoordenada: foto.tieneCoordenada,
        descripcion: foto.descripcion,

        // Parent capture metadata
        alias: captura.alias,
        folio: captura.folioEvidence,
        grupo: captura.grupo,
        firma: captura.firma,
        urlBase: captura.urlBase,
        estatus: captura.estatus,
        fecha: captura.fecha,
        fieldName: campo.nombre,
      });
    }
  }

  return photos;
}
