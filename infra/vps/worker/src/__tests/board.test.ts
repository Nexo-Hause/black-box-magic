import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mockear las colas para evitar intentos de conexión a Redis real en tests unitarios
vi.mock('../queues', () => ({
  ubiqoProcessQueue: { name: 'ubiqoProcessQueue' },
  planogramProcessQueue: { name: 'planogramProcessQueue' },
  reconcileQueue: { name: 'reconcileQueue' },
}));

import { getClientIp, authMiddleware, authAttempts } from '../board';
import express from 'express';

describe('Seguridad y Rate Limiting del Panel de Control (board.ts)', () => {
  let originalNodeEnv: string | undefined;
  let originalAdminUser: string | undefined;
  let originalAdminPass: string | undefined;
  let originalTrustProxy: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalAdminUser = process.env.WORKER_ADMIN_USER;
    originalAdminPass = process.env.WORKER_ADMIN_PASS;
    originalTrustProxy = process.env.WORKER_TRUST_PROXY;

    (process.env as any).NODE_ENV = 'test';
    // Aseguramos credenciales de test limpias
    process.env.WORKER_ADMIN_USER = 'test-admin';
    process.env.WORKER_ADMIN_PASS = 'test-pass';
    authAttempts.clear();
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    process.env.WORKER_ADMIN_USER = originalAdminUser;
    process.env.WORKER_ADMIN_PASS = originalAdminPass;
    process.env.WORKER_TRUST_PROXY = originalTrustProxy;
  });

  describe('Normalización de IP (getClientIp)', () => {
    it('debe retornar la IP del socket si WORKER_TRUST_PROXY no está activado', () => {
      process.env.WORKER_TRUST_PROXY = 'false';
      
      const req = {
        ip: '192.168.1.100',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
      } as unknown as express.Request;

      const ip = getClientIp(req);
      expect(ip).toBe('192.168.1.100');
    });

    it('debe retornar la IP del socket si WORKER_TRUST_PROXY es true pero no hay cabecera X-Forwarded-For', () => {
      process.env.WORKER_TRUST_PROXY = 'true';
      
      const req = {
        ip: '192.168.1.100',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {},
      } as unknown as express.Request;

      const ip = getClientIp(req);
      expect(ip).toBe('192.168.1.100');
    });

    it('debe retornar la IP más a la derecha (último proxy/cliente confiable) si WORKER_TRUST_PROXY es true', () => {
      process.env.WORKER_TRUST_PROXY = 'true';
      
      const req = {
        ip: '192.168.1.100',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
      } as unknown as express.Request;

      const ip = getClientIp(req);
      expect(ip).toBe('70.41.3.18');
    });

    it('debe retornar la última IP del arreglo en X-Forwarded-For si viene como array', () => {
      process.env.WORKER_TRUST_PROXY = 'true';
      
      const req = {
        ip: '192.168.1.100',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {
          'x-forwarded-for': ['203.0.113.195, 70.41.3.18'],
        },
      } as unknown as express.Request;

      const ip = getClientIp(req);
      expect(ip).toBe('70.41.3.18');
    });
  });

  describe('Middleware de Autenticación Básica (authMiddleware)', () => {
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
      };
      mockNext = vi.fn();
    });

    it('debe retornar 401 si no se envía cabecera de autorización', () => {
      const req = {
        ip: '127.0.0.1',
        headers: {},
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('WWW-Authenticate', expect.any(String));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Authentication required');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe retornar 401 si el formato de la cabecera no es Basic', () => {
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: 'Bearer token123',
        },
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid auth header format');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe retornar 401 si las credenciales decodificadas no tienen el formato correcto (usuario:password)', () => {
      // "solousuario" codificado en base64 es "c29sb3VzdWFyaW8="
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: 'Basic c29sb3VzdWFyaW8=',
        },
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid credentials format');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe permitir el paso (llamar a next) con credenciales correctas y limpiar los intentos del rate limiter', () => {
      // "test-admin:test-pass" en base64 es "dGVzdC1hZG1pbjp0ZXN0LXBhc3M="
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: 'Basic dGVzdC1hZG1pbjp0ZXN0LXBhc3M=',
        },
        socket: {},
      } as unknown as express.Request;

      // Colocar un intento fallido previo
      authAttempts.set('127.0.0.1', { count: 1, lastAttempt: Date.now() });

      authMiddleware(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(authAttempts.has('127.0.0.1')).toBe(false); // Debe haberse limpiado
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('debe retornar 401 e incrementar los intentos fallidos con credenciales incorrectas', () => {
      // "test-admin:incorrecto" en base64 es "dGVzdC1hZG1pbjppbmNvcnJlY3Rv"
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: 'Basic dGVzdC1hZG1pbjppbmNvcnJlY3Rv',
        },
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid credentials');
      expect(mockNext).not.toHaveBeenCalled();

      // Debe registrar el intento
      const attempt = authAttempts.get('127.0.0.1');
      expect(attempt).toBeDefined();
      expect(attempt?.count).toBe(1);
    });

    it('debe retornar 429 cuando se exceden los 5 intentos fallidos dentro de la ventana de 15 minutos', () => {
      const ip = '192.168.1.5';
      const req = {
        ip,
        headers: {
          authorization: 'Basic dGVzdC1hZG1pbjppbmNvcnJlY3Rv',
        },
        socket: {},
      } as unknown as express.Request;

      // Establecer 5 intentos fallidos
      authAttempts.set(ip, { count: 5, lastAttempt: Date.now() });

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Too many login attempts'));
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    it('debe mitigar bypasses de comparación mitigando ataques de timing', () => {
      // "test-admin:test-pass" es la credencial correcta
      // Intentamos con una credencial incorrecta de longitud diferente
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: 'Basic dGVzdC1hZG1pbjpsYXJnZXBhc3N3b3JkdGhhdGlzd3Jvbmc=', // "test-admin:largepasswordthatiswrong"
        },
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe retornar 400 si las credenciales en la cabecera superan el límite de tamaño', () => {
      // Generar un string extremadamente largo (más de 1024 caracteres)
      const longCreds = 'a'.repeat(1100);
      const encodedCreds = Buffer.from(longCreds).toString('base64');
      const req = {
        ip: '127.0.0.1',
        headers: {
          authorization: `Basic ${encodedCreds}`,
        },
        socket: {},
      } as unknown as express.Request;

      authMiddleware(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith('Credentials too long');
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
