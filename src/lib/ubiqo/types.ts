/**
 * Ubiqo API types — based on Phase 0 validation (docs/ubiqo/api-validation-2026-03-31.md)
 *
 * Key corrections from spec 00:
 * - latitud/longitud are STRINGS, not numbers
 * - estatus is "Completa" (not "validado")
 * - firma is a capture-level field (CloudFront signed URL)
 * - Only idTipo=7 has photos
 * - fotografia field is empty string (not used)
 */

import { z } from 'zod/v4';

// ─── Ubiqo API response interfaces ─────────────────────────────────────────

/** A single photograph within a gallery field (idTipo=7) */
export interface UbiqoFotografia {
  fotografia: string;           // Always empty string in practice
  url: string;                  // Relative path: "Capsulas/{empresaId}-{movilId}-{unixMs}.jpg"
  descripcion: string;          // Empty string in current form
  latitud: string;              // String, e.g. "19.405715" — parse with parseFloat()
  longitud: string;             // String, e.g. "-99.2735567" — parse with parseFloat()
  tieneCoordenada: boolean;
}

/** A single field within captura.capturas[] */
export interface UbiqoCapturaBase {
  idTipo: number;               // 1=text, 6=unknown, 7=gallery (only 7 has photos)
  nombre: string;               // Field label
  valor: string;                // Field value (text fields)
  fotografias: UbiqoFotografia[] | null;  // Only present when idTipo=7
}

/** Top-level capture object from GET /v1/Capturas/Rango */
export interface UbiqoCaptura {
  alias: string;                // Promoter name, e.g. "GALINDO RAMOS PATRICIA"
  username: string;             // e.g. "admin.metrica"
  estatus: string;              // "Completa" (may have other values)
  motivo: string | null;        // Rejection reason
  idMovil: number;              // Mobile device ID
  grupo: string;                // UUID — unique capture identifier
  fecha: string;                // ISO 8601 UTC
  fechaInicial: string;         // ISO 8601 with ms
  fechaSincronizacion: string;  // ISO 8601 with ms
  fechaRechazo: string | null;
  nombreUsuarioRechazo: string | null;
  usernameRechazo: string | null;
  fechaValido: string | null;
  nombreUsuarioValido: string | null;
  usernameValido: string | null;
  urlBase: string;              // CloudFront CDN base URL
  firma: string;                // CloudFront signed URL query params: "?Policy=...&Signature=...&Key-Pair-Id=..."
  folioEvidence: string;        // Format: "{fecha}-{formId}-{movilId}"
  catalogosMetaData: unknown;   // Nullable metadata object
  capturas: UbiqoCapturaBase[]; // Form fields (text, galleries, etc.)
}

// ─── Flattened photo with parent capture metadata ───────────────────────────

/** Photo enriched with metadata from its parent capture — used after extraction */
export interface UbiqoPhoto {
  // Photo fields
  url: string;                  // Relative path (stable, used for dedup)
  latitud: string;
  longitud: string;
  tieneCoordenada: boolean;
  descripcion: string;

  // Parent capture metadata
  alias: string;                // Promoter name
  folio: string;                // folioEvidence
  grupo: string;                // Capture UUID (for dedup)
  firma: string;                // CloudFront signed URL params
  urlBase: string;              // CDN base URL
  estatus: string;              // Capture status
  fecha: string;                // Capture date (ISO 8601)
  fieldName: string;            // Name of the gallery field this photo belongs to
}

// ─── Zod schemas for ingest request validation ──────────────────────────────

/**
 * Timestamp format: YYYYMMDDHHmmss (14 digits)
 * Example: "20260317000000" for March 17, 2026 00:00:00
 */
const ubiqoTimestampSchema = z.string().regex(
  /^\d{14}$/,
  'Timestamp must be 14 digits in YYYYMMDDHHmmss format'
);

/** Ingest request body — validated before calling Ubiqo API */
export const ingestRequestSchema = z.object({
  form_id: z.number().int().positive(),
  from: ubiqoTimestampSchema,
  to: ubiqoTimestampSchema,
  tz: z.string().optional(),    // IANA timezone, e.g. "America/Mexico_City"
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;
