import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ubiqoProcessQueue, planogramProcessQueue, reconcileQueue } from './queues';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'crypto';

dotenv.config();

const app = express();
const port = process.env.WORKER_PORT || 3005;

// Requerir variables de entorno de administración explícitas, sin fallbacks inseguros.
// Se provee un fallback seguro solo durante la ejecución de pruebas unitarias para no abortar el proceso.
const adminUser = process.env.WORKER_ADMIN_USER || (process.env.NODE_ENV === 'test' ? 'test-admin' : '');
const adminPass = process.env.WORKER_ADMIN_PASS || (process.env.NODE_ENV === 'test' ? 'test-pass' : '');

if (!adminUser || !adminPass) {
  console.error('[Board] Error: WORKER_ADMIN_USER y WORKER_ADMIN_PASS son variables requeridas.');
  process.exit(1);
}

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(ubiqoProcessQueue) as any,
    new BullMQAdapter(planogramProcessQueue) as any,
    new BullMQAdapter(reconcileQueue) as any,
  ],
  serverAdapter,
});

// Almacén en memoria simple para limitar intentos de autenticación (Rate Limiting contra Fuerza Bruta)
export const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Normalizar IP con validación de proxy confiable para evitar IP Spoofing
export function getClientIp(req: express.Request): string {
  const trustProxy = process.env.WORKER_TRUST_PROXY === 'true';
  
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Tomar la IP más confiable (última del proxy chain, no la primera)
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const ipList = ips.split(',').map(ip => ip.trim()).filter(ip => ip);
      // Última IP = más cercana al servidor (confiable), primera = cliente original (spoofable)
      const lastIp = ipList[ipList.length - 1];
      if (lastIp) return lastIp;
    }
  }
  
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Middleware de autenticación básica (Basic Auth) con Rate Limiting y seguridad mejorada
export const authMiddleware: express.RequestHandler = (req, res, next) => {
  const ipStr = getClientIp(req);
  const now = Date.now();
  
  const attempts = authAttempts.get(ipStr);
  
  // Limitar a máximo 5 intentos fallidos cada 15 minutos
  if (attempts && attempts.count >= 5 && (now - attempts.lastAttempt) < 15 * 60 * 1000) {
    const remainingTime = Math.ceil((15 * 60 * 1000 - (now - attempts.lastAttempt)) / 1000 / 60);
    res.status(429).send(`Too many login attempts. Try again in ${remainingTime} minutes.`);
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    res.status(401).send('Authentication required');
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    res.status(401).send('Invalid auth header format');
    return;
  }

  const MAX_CREDENTIAL_LEN = 1024; // Límite razonable para usuario:password en base64

  if (parts[1].length > MAX_CREDENTIAL_LEN * 4 / 3) { // Factor de expansión base64
    res.status(400).send('Credentials too long');
    return;
  }

  const credentialsStr = Buffer.from(parts[1], 'base64').toString();
  if (credentialsStr.length > MAX_CREDENTIAL_LEN) {
    res.status(400).send('Credentials too long');
    return;
  }

  const colonIndex = credentialsStr.indexOf(':');
  if (colonIndex === -1 || colonIndex === 0 || colonIndex === credentialsStr.length - 1) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    res.status(401).send('Invalid credentials format');
    return;
  }

  const user = credentialsStr.slice(0, colonIndex);
  const pass = credentialsStr.slice(colonIndex + 1);

  // Mitigar ataques de timing mediante comparación con buffers de longitud fija (MAX_CREDENTIAL_LEN)
  const userBuf = Buffer.alloc(MAX_CREDENTIAL_LEN);
  const passBuf = Buffer.alloc(MAX_CREDENTIAL_LEN);
  userBuf.write(user);
  passBuf.write(pass);

  const adminUserBuf = Buffer.alloc(MAX_CREDENTIAL_LEN);
  const adminPassBuf = Buffer.alloc(MAX_CREDENTIAL_LEN);
  adminUserBuf.write(adminUser);
  adminPassBuf.write(adminPass);

  // timingSafeEqual siempre compara exactamente MAX_CREDENTIAL_LEN bytes, mitigando cualquier leak de longitud
  const userMatch = timingSafeEqual(userBuf, adminUserBuf);
  const passMatch = timingSafeEqual(passBuf, adminPassBuf);

  if (userMatch && passMatch) {
    authAttempts.delete(ipStr); // Reset en inicio de sesión exitoso
    next();
    return;
  }

  // Incrementar intentos fallidos
  authAttempts.set(ipStr, {
    count: (attempts?.count || 0) + 1,
    lastAttempt: now
  });

  res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
  res.status(401).send('Invalid credentials');
  return;
};

app.use('/admin/queues', authMiddleware);

app.use('/admin/queues', serverAdapter.getRouter());

// Iniciar servidor solo si no estamos en entorno de pruebas unitarias
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`📊 Bull Board ejecutándose en http://localhost:${port}/admin/queues`);
  });
}

export default app;
