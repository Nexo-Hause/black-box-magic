/**
 * SSRF protection — unit tests
 *
 * Tests validatePhotoUrl and downloadPhoto.
 * No real network calls — fetch is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validatePhotoUrl, downloadPhoto } from '@/lib/ubiqo/ssrf';

// ─── validatePhotoUrl ───────────────────────────────────────────────────────

describe('validatePhotoUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear custom domains to use default *.cloudfront.net pattern
    delete process.env.UBIQO_PHOTO_DOMAINS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts a valid CloudFront HTTPS URL', () => {
    const url = 'https://d1abc123.cloudfront.net/Capsulas/img.jpg?Policy=x&Signature=y';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a URL from an explicitly allowlisted domain', () => {
    process.env.UBIQO_PHOTO_DOMAINS = 'cdn.example.com,d1abc.cloudfront.net';
    const url = 'https://cdn.example.com/photo.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(true);
  });

  it('rejects HTTP URLs (non-HTTPS)', () => {
    const url = 'http://d1abc123.cloudfront.net/Capsulas/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Only HTTPS URLs are allowed');
  });

  it('rejects 127.0.0.1 (loopback)', () => {
    const url = 'https://127.0.0.1/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects 10.x.x.x (RFC 1918)', () => {
    const url = 'https://10.0.0.1/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects 192.168.x.x (RFC 1918)', () => {
    const url = 'https://192.168.1.1/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects 172.16.x.x (RFC 1918)', () => {
    const url = 'https://172.16.0.1/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects 169.254.x.x (link-local)', () => {
    const url = 'https://169.254.169.254/latest/meta-data/';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects localhost', () => {
    const url = 'https://localhost/img.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Private/internal addresses are not allowed');
  });

  it('rejects non-allowlisted domain', () => {
    const url = 'https://evil.example.com/malicious.jpg';
    const result = validatePhotoUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hostname not in allowlist');
  });

  it('rejects invalid URL format', () => {
    const result = validatePhotoUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });
});

// ─── downloadPhoto ──────────────────────────────────────────────────────────

describe('downloadPhoto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UBIQO_PHOTO_DOMAINS;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('downloads a valid photo and returns buffer + contentType', async () => {
    const imageBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic bytes

    // Create a ReadableStream from the bytes
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(imageBytes);
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(imageBytes.length),
        },
      })
    );

    const url = 'https://d1abc123.cloudfront.net/Capsulas/img.jpg?Policy=x';
    const result = await downloadPhoto(url);

    expect(result.contentType).toBe('image/jpeg');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBe(4);
  });

  it('rejects non-image Content-Type', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>hack</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const url = 'https://d1abc123.cloudfront.net/Capsulas/img.jpg?Policy=x';
    await expect(downloadPhoto(url)).rejects.toThrow('unexpected Content-Type');
  });

  it('blocks download for URLs that fail validation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      downloadPhoto('http://d1abc123.cloudfront.net/img.jpg')
    ).rejects.toThrow('Photo download blocked');

    // fetch should never be called when validation fails
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when Content-Length exceeds 10MB', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(11 * 1024 * 1024), // 11MB
        },
      })
    );

    const url = 'https://d1abc123.cloudfront.net/Capsulas/big.jpg?Policy=x';
    await expect(downloadPhoto(url)).rejects.toThrow('Photo too large');
  });

  it('throws on HTTP error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const url = 'https://d1abc123.cloudfront.net/Capsulas/missing.jpg?Policy=x';
    await expect(downloadPhoto(url)).rejects.toThrow('Photo download HTTP 404');
  });
});
