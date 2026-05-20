import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ubiqoProcessQueue, planogramProcessQueue, reconcileQueue } from './queues';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.WORKER_PORT || 3005;

// Requerir variables de entorno de administración explícitas, sin fallbacks inseguros
const adminUser = process.env.WORKER_ADMIN_USER;
const adminPass = process.env.WORKER_ADMIN_PASS;

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
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Middleware de autenticación básica (Basic Auth) con Rate Limiting y seguridad mejorada
app.use('/admin/queues', (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipStr = Array.isArray(ip) ? ip[0] : String(ip);
  const now = Date.now();
  
  const attempts = authAttempts.get(ipStr);
  
  // Limitar a máximo 5 intentos fallidos cada 15 minutos
  if (attempts && attempts.count >= 5 && (now - attempts.lastAttempt) < 15 * 60 * 1000) {
    const remainingTime = Math.ceil((15 * 60 * 1000 - (now - attempts.lastAttempt)) / 1000 / 60);
    return res.status(429).send(`Too many login attempts. Try again in ${remainingTime} minutes.`);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    return res.status(401).send('Authentication required');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    return res.status(401).send('Invalid auth header format');
  }

  const credentials = Buffer.from(parts[1], 'base64').toString().split(':');
  if (credentials.length !== 2) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    return res.status(401).send('Invalid credentials format');
  }

  const user = credentials[0];
  const pass = credentials[1];

  if (user === adminUser && pass === adminPass) {
    authAttempts.delete(ipStr); // Reset en inicio de sesión exitoso
    return next();
  }

  // Incrementar intentos fallidos
  authAttempts.set(ipStr, {
    count: (attempts?.count || 0) + 1,
    lastAttempt: now
  });

  res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
  return res.status(401).send('Invalid credentials');
});

app.use('/admin/queues', serverAdapter.getRouter());

app.listen(port, () => {
  console.log(`📊 Bull Board ejecutándose en http://localhost:${port}/admin/queues`);
});
export default app;
