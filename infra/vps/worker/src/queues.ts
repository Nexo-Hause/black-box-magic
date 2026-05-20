import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Requerido por BullMQ
});

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 segundos
    },
    removeOnComplete: {
      age: 24 * 3600, // Mantener completados por 24 horas para Bull Board
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Mantener fallidos por 7 días
      count: 5000,
    },
  },
};

// Colas del pipeline
export const ubiqoProcessQueue = new Queue('ubiqo-process', defaultQueueOptions);
export const planogramProcessQueue = new Queue('planogram-process', defaultQueueOptions);
export const reconcileQueue = new Queue('reconcile', defaultQueueOptions);

