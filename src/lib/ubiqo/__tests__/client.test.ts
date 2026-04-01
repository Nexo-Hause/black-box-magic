/**
 * Ubiqo client — unit tests
 *
 * Tests buildPhotoUrl, extractPhotos, and fetchCaptures.
 * No real API calls — fetch is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPhotoUrl, extractPhotos, fetchCaptures } from '@/lib/ubiqo/client';
import type { UbiqoCaptura, UbiqoCapturaBase, UbiqoFotografia } from '@/lib/ubiqo/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeFoto(overrides: Partial<UbiqoFotografia> = {}): UbiqoFotografia {
  return {
    fotografia: '',
    url: 'Capsulas/123-456-1711900000000.jpg',
    descripcion: '',
    latitud: '19.405715',
    longitud: '-99.2735567',
    tieneCoordenada: true,
    ...overrides,
  };
}

function makeCampo(overrides: Partial<UbiqoCapturaBase> = {}): UbiqoCapturaBase {
  return {
    idTipo: 7,
    nombre: 'Fotos del punto',
    valor: '',
    fotografias: [makeFoto()],
    ...overrides,
  };
}

function makeCaptura(overrides: Partial<UbiqoCaptura> = {}): UbiqoCaptura {
  return {
    alias: 'GALINDO RAMOS PATRICIA',
    username: 'admin.metrica',
    estatus: 'Completa',
    motivo: null,
    idMovil: 1001,
    grupo: 'abc-123-uuid',
    fecha: '2026-03-17T12:00:00Z',
    fechaInicial: '2026-03-17T12:00:00.000Z',
    fechaSincronizacion: '2026-03-17T12:05:00.000Z',
    fechaRechazo: null,
    nombreUsuarioRechazo: null,
    usernameRechazo: null,
    fechaValido: null,
    nombreUsuarioValido: null,
    usernameValido: null,
    urlBase: 'https://d1example.cloudfront.net/',
    firma: '?Policy=abc&Signature=xyz&Key-Pair-Id=KP1',
    folioEvidence: '20260317-30143-1001',
    catalogosMetaData: null,
    capturas: [makeCampo()],
    ...overrides,
  };
}

// ─── buildPhotoUrl ──────────────────────────────────────────────────────────

describe('buildPhotoUrl', () => {
  it('concatenates urlBase + foto.url + firma', () => {
    const captura = {
      urlBase: 'https://cdn.cloudfront.net/',
      firma: '?Policy=p&Signature=s&Key-Pair-Id=k',
    };
    const foto = { url: 'Capsulas/img-001.jpg' };

    const result = buildPhotoUrl(captura, foto);

    expect(result).toBe(
      'https://cdn.cloudfront.net/Capsulas/img-001.jpg?Policy=p&Signature=s&Key-Pair-Id=k'
    );
  });

  it('works with empty firma (unsigned URL)', () => {
    const captura = { urlBase: 'https://cdn.cloudfront.net/', firma: '' };
    const foto = { url: 'Capsulas/img-002.jpg' };

    expect(buildPhotoUrl(captura, foto)).toBe(
      'https://cdn.cloudfront.net/Capsulas/img-002.jpg'
    );
  });
});

// ─── extractPhotos ──────────────────────────────────────────────────────────

describe('extractPhotos', () => {
  it('extracts photos from idTipo=7 fields and includes parent metadata', () => {
    const captura = makeCaptura();
    const photos = extractPhotos(captura);

    expect(photos).toHaveLength(1);
    expect(photos[0].url).toBe('Capsulas/123-456-1711900000000.jpg');
    expect(photos[0].alias).toBe('GALINDO RAMOS PATRICIA');
    expect(photos[0].folio).toBe('20260317-30143-1001');
    expect(photos[0].grupo).toBe('abc-123-uuid');
    expect(photos[0].fieldName).toBe('Fotos del punto');
    expect(photos[0].urlBase).toBe('https://d1example.cloudfront.net/');
    expect(photos[0].firma).toBe('?Policy=abc&Signature=xyz&Key-Pair-Id=KP1');
  });

  it('flattens multiple photos from a single gallery field', () => {
    const captura = makeCaptura({
      capturas: [
        makeCampo({
          fotografias: [makeFoto({ url: 'img1.jpg' }), makeFoto({ url: 'img2.jpg' })],
        }),
      ],
    });

    const photos = extractPhotos(captura);
    expect(photos).toHaveLength(2);
    expect(photos[0].url).toBe('img1.jpg');
    expect(photos[1].url).toBe('img2.jpg');
  });

  it('returns empty array for captures with no photos', () => {
    const captura = makeCaptura({
      capturas: [makeCampo({ fotografias: null })],
    });

    expect(extractPhotos(captura)).toEqual([]);
  });

  it('returns empty array when fotografias is an empty array', () => {
    const captura = makeCaptura({
      capturas: [makeCampo({ fotografias: [] })],
    });

    expect(extractPhotos(captura)).toEqual([]);
  });

  it('skips idTipo=1 (text) fields', () => {
    const captura = makeCaptura({
      capturas: [
        makeCampo({ idTipo: 1, nombre: 'Nombre tienda', valor: 'OXXO Centro' }),
        makeCampo({ idTipo: 7, fotografias: [makeFoto()] }),
      ],
    });

    const photos = extractPhotos(captura);
    expect(photos).toHaveLength(1);
    expect(photos[0].fieldName).toBe('Fotos del punto');
  });

  it('skips idTipo=6 fields', () => {
    const captura = makeCaptura({
      capturas: [
        makeCampo({ idTipo: 6, nombre: 'Campo desconocido' }),
      ],
    });

    expect(extractPhotos(captura)).toEqual([]);
  });

  it('skips photos with empty url', () => {
    const captura = makeCaptura({
      capturas: [
        makeCampo({
          fotografias: [makeFoto({ url: '' }), makeFoto({ url: 'valid.jpg' })],
        }),
      ],
    });

    const photos = extractPhotos(captura);
    expect(photos).toHaveLength(1);
    expect(photos[0].url).toBe('valid.jpg');
  });
});

// ─── fetchCaptures ──────────────────────────────────────────────────────────

describe('fetchCaptures', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.UBIQO_API_TOKEN = 'test-token-abc';
    process.env.UBIQO_API_BASE = 'https://bi.ubiqo.net';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('constructs correct URL and sends Bearer auth header', async () => {
    const mockData: UbiqoCaptura[] = [makeCaptura()];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await fetchCaptures(30143, '20260317000000', '20260318000000');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(
      'https://bi.ubiqo.net/v1/Capturas/Rango/30143/20260317000000/20260318000000'
    );
    expect(calledInit?.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer test-token-abc',
        Accept: 'application/json',
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].alias).toBe('GALINDO RAMOS PATRICIA');
  });

  it('appends tz query param when provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    await fetchCaptures(30143, '20260317000000', '20260318000000', 'America/Mexico_City');

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('tz=America%2FMexico_City');
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
    );

    await expect(
      fetchCaptures(30143, '20260317000000', '20260318000000')
    ).rejects.toThrow('Ubiqo API error: 401 Unauthorized');
  });

  it('throws when UBIQO_API_TOKEN is not set', async () => {
    delete process.env.UBIQO_API_TOKEN;

    await expect(
      fetchCaptures(30143, '20260317000000', '20260318000000')
    ).rejects.toThrow('UBIQO_API_TOKEN environment variable is not set');
  });
});
