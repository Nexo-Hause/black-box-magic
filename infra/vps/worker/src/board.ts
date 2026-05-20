import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ubiqoProcessQueue, planogramProcessQueue } from './queues';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.WORKER_PORT || 3005;

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(ubiqoProcessQueue) as any,
    new BullMQAdapter(planogramProcessQueue) as any,
  ],
  serverAdapter,
});

// Middleware de autenticación básica (Basic Auth) para seguridad en VPS
app.use('/admin/queues', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
    return res.status(401).send('Authentication required');
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = auth[0];
  const pass = auth[1];

  const adminUser = process.env.WORKER_ADMIN_USER || 'admin';
  const adminPass = process.env.WORKER_ADMIN_PASS || 'bbm-secret-pass-2026';

  if (user === adminUser && pass === adminPass) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="BBM Worker Dashboard"');
  return res.status(401).send('Invalid credentials');
});

app.use('/admin/queues', serverAdapter.getRouter());

app.listen(port, () => {
  console.log(`📊 Bull Board ejecutándose en http://localhost:${port}/admin/queues`);
});
export default app;
