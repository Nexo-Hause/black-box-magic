/**
 * Black Box Magic — Photo Download with SSRF Protection
 *
 * Downloads photos from Ubiqo Evidence URLs (CloudFront-signed).
 * Validates against allowlist, rejects private IPs, enforces HTTPS.
 *
 * IMPORTANT: Never log full URLs — the query string contains signed credentials (firma).
 */

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const TIMEOUT_MS = 30_000; // 30s
const DEFAULT_ALLOWED_PATTERN = /\.cloudfront\.net$/;

// RFC 1918 + loopback — reject these regardless of allowlist
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,       // link-local
  /^::1$/,
  /^fc00:/i,           // IPv6 unique local
  /^fe80:/i,           // IPv6 link-local
  /^fd[0-9a-f]{2}:/i,  // IPv6 ULA
  /^localhost$/i,
  // IPv6-mapped IPv4 private addresses (e.g. ::ffff:127.0.0.1, ::ffff:192.168.1.1)
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.)/i,
];

/**
 * Strips query params from a URL for safe logging.
 * The query string contains the CloudFront firma (credential).
 */
function safeLogUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Returns the list of allowed hostnames from UBIQO_PHOTO_DOMAINS env var.
 * If empty, falls back to *.cloudfront.net pattern matching.
 */
function getAllowedDomains(): string[] {
  const raw = process.env.UBIQO_PHOTO_DOMAINS || '';
  return raw.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if a hostname matches the allowlist or default CloudFront pattern.
 */
function isHostnameAllowed(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const allowed = getAllowedDomains();

  if (allowed.length > 0) {
    return allowed.includes(lower);
  }

  // Fallback: allow *.cloudfront.net
  return DEFAULT_ALLOWED_PATTERN.test(lower);
}

/**
 * Check if a hostname looks like a private/internal IP address.
 */
function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

/**
 * Validates a photo URL without downloading it.
 * Returns { valid: true } or { valid: false, error: '...' }.
 */
export function validatePhotoUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Normalize hostname: decode percent-encoding and lower-case before checks.
  // new URL() handles most normalization, but explicit decode guards against
  // obfuscation techniques that could bypass private-IP pattern matching.
  let hostname: string;
  try {
    hostname = decodeURIComponent(parsed.hostname).toLowerCase();
    // Reject if decoded hostname still contains '%' — double-encoding attack
    if (hostname.includes('%')) {
      return { valid: false, error: 'Invalid hostname encoding' };
    }
  } catch {
    return { valid: false, error: 'Invalid hostname encoding' };
  }

  if (isPrivateHost(hostname)) {
    return { valid: false, error: 'Private/internal addresses are not allowed' };
  }

  if (!isHostnameAllowed(hostname)) {
    return { valid: false, error: `Hostname not in allowlist: ${hostname}` };
  }

  return { valid: true };
}

/**
 * Downloads a photo with full SSRF protection.
 *
 * - HTTPS only
 * - Hostname must be in UBIQO_PHOTO_DOMAINS allowlist (or *.cloudfront.net)
 * - Rejects private IPs
 * - Content-Type must start with 'image/'
 * - Max 10MB response
 * - 30s timeout
 * - Never logs full URL (firma is a credential)
 *
 * @throws Error with safe message (no signed URL params leaked)
 */
export async function downloadPhoto(photoUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  // --- Validate URL before any network request ---
  const validation = validatePhotoUrl(photoUrl);
  if (!validation.valid) {
    throw new Error(`Photo download blocked: ${validation.error}`);
  }

  const logPath = safeLogUrl(photoUrl);

  // --- Fetch with timeout ---
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(photoUrl, {
      signal: controller.signal,
      redirect: 'error', // Do not follow redirects (could redirect to internal hosts)
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Photo download timed out after ${TIMEOUT_MS}ms: ${logPath}`);
    }
    throw new Error(`Photo download failed: ${logPath} — ${err instanceof Error ? err.message : 'unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Photo download HTTP ${response.status}: ${logPath}`);
  }

  // --- Validate Content-Type ---
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Photo download rejected: unexpected Content-Type "${contentType}" for ${logPath}`);
  }

  // --- Read body with size limit ---
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  // Check Content-Length header first for early rejection
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
    throw new Error(`Photo too large (${contentLength} bytes, max ${MAX_SIZE_BYTES}): ${logPath}`);
  }

  // Stream the body to enforce actual size limit
  if (!response.body) {
    throw new Error(`Photo download returned empty body: ${logPath}`);
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > MAX_SIZE_BYTES) {
        reader.cancel();
        throw new Error(`Photo exceeds ${MAX_SIZE_BYTES} bytes during download: ${logPath}`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const buffer = Buffer.concat(chunks);

  return { buffer, contentType };
}
