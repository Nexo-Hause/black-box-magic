import { Worker, Job } from 'bullmq';
import { connection, ubiqoProcessQueue, planogramProcessQueue } from './queues';
import { supabase } from '@/lib/supabase';
import { downloadPhoto } from '@/lib/ubiqo/ssrf';
import { decryptFirma, encryptFirma } from '@/lib/ubiqo/crypto';
import { analyzePhoto } from '@/lib/analyze';
import { fetchCaptures, extractPhotos, buildPhotoUrl } from '@/lib/ubiqo/client';
import { downloadPlanogram } from '@/lib/planogram/storage';
import { buildIncidencePrompt } from '@/lib/planogram/incidence-prompt';
import { parseIncidenceResponse } from '@/lib/planogram/incidence-parser';
import { analyzeWithReferences } from '@/lib/gemini';
import { processUbiqoCapture, ingestUbiqoCaptures } from '@/lib/pipeline/ubiqo';
import { processIncidence, ingestPlanogramCaptures } from '@/lib/pipeline/planogram';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_COST_PER_TOKEN = 0.000007; // Costo estimado promedio por token ($7 USD por millón)
const DEFAULT_BUDGET_LIMIT = 50.0; // $50 USD por defecto si no se configura

// ─── Control de Costos de Gemini ───
export async function checkGeminiDailyBudgetLimit(): Promise<{ exceeded: boolean; cost: number; limit: number }> {
  const limitStr = process.env.GEMINI_DAILY_BUDGET_LIMIT;
  let limit = limitStr ? parseFloat(limitStr) : DEFAULT_BUDGET_LIMIT;

  if (isNaN(limit) || limit < 0) {
    console.error(`[Budget] GEMINI_DAILY_BUDGET_LIMIT inválido: "${limitStr}". Usando default: ${DEFAULT_BUDGET_LIMIT}`);
    limit = DEFAULT_BUDGET_LIMIT;
  }

  if (!supabase) {
    console.warn('[Budget] Supabase no configurado, omitiendo validación de presupuesto.');
    return { exceeded: false, cost: 0, limit };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // 1. Sumar tokens en Ubiqo captures procesados hoy
  const { data: ubiqoData, error: ubiqoErr } = await supabase
    .from('bbm_ubiqo_captures')
    .select('tokens_total')
    .gte('analyzed_at', todayISO)
    .not('tokens_total', 'is', null);

  if (ubiqoErr) {
    console.error('[Budget] Error consultando tokens de Ubiqo:', ubiqoErr.message);
  }

  // 2. Sumar tokens en Incidences procesados hoy
  const { data: incidenceData, error: incidenceErr } = await supabase
    .from('bbm_incidences')
    .select('tokens_total')
    .gte('processed_at', todayISO)
    .not('tokens_total', 'is', null);

  if (incidenceErr) {
    console.error('[Budget] Error consultando tokens de Incidencias:', incidenceErr.message);
  }

  const ubiqoTokens = (ubiqoData || []).reduce((sum: number, row: any) => sum + (row.tokens_total || 0), 0);
  const incidenceTokens = (incidenceData || []).reduce((sum: number, row: any) => sum + (row.tokens_total || 0), 0);

  const totalTokens = ubiqoTokens + incidenceTokens;
  const estimatedCost = totalTokens * GEMINI_COST_PER_TOKEN;

  const exceeded = estimatedCost >= limit;
  return { exceeded, cost: estimatedCost, limit };
}

// ─── Worker de Procesamiento Ubiqo ───
const ubiqoWorker = new Worker(
  'ubiqo-process',
  async (job: Job) => {
    console.log(`[Ubiqo Worker] Procesando job ${job.id} para captura ${job.data.captureId}`);
    
    // Verificación de límite de presupuesto
    const budget = await checkGeminiDailyBudgetLimit();
    if (budget.exceeded) {
      const msg = `[Budget Exceeded] Límite diario de Gemini alcanzado: $${budget.cost.toFixed(2)} / $${budget.limit.toFixed(2)} USD.`;
      console.warn(msg);
      throw new Error(msg); // Lanza error para que BullMQ reintente/pause el job
    }

    if (!supabase) throw new Error('Supabase cliente no disponible');

    // Cargar la fila de la captura
    const { data: capture, error } = await supabase
      .from('bbm_ubiqo_captures')
      .select('*')
      .eq('id', job.data.captureId)
      .single();

    if (error || !capture) {
      throw new Error(`Captura ${job.data.captureId} no encontrada en base de datos: ${error?.message}`);
    }

    if (capture.status !== 'pending' && capture.status !== 'processing') {
      console.log(`[Ubiqo Worker] Captura ${job.data.captureId} ya está en estado '${capture.status}', omitiendo.`);
      return { status: 'skipped', captureId: capture.id };
    }

    // Marcar en proceso
    await supabase
      .from('bbm_ubiqo_captures')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', capture.id);

    // Inyectar dependencias reales
    const deps = {
      downloadPhoto,
      analyzePhoto,
      decryptFirma,
      supabase,
    };

    try {
      const result = await processUbiqoCapture(capture, deps);
      console.log(`[Ubiqo Worker] Éxito en captura ${capture.id}. Tokens: ${result.tokens}.`);
      return result;
    } catch (err: any) {
      console.error(`[Ubiqo Worker] Error procesando captura ${capture.id}:`, err.message);
      
      // Incrementar contador de reintentos y marcar fallido
      const currentRetry = (capture.retry_count || 0) + 1;
      const newStatus = currentRetry >= 3 ? 'failed' : 'pending';

      await supabase
        .from('bbm_ubiqo_captures')
        .update({
          status: newStatus,
          retry_count: currentRetry,
          error_log: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', capture.id);

      throw err;
    }
  },
  { connection, concurrency: 2 }
);

// ─── Worker de Procesamiento Planogramas (Incidencias) ───
const planogramWorker = new Worker(
  'planogram-process',
  async (job: Job) => {
    console.log(`[Planogram Worker] Procesando job ${job.id} para incidencia ${job.data.incidenceId}`);

    // Verificación de límite de presupuesto
    const budget = await checkGeminiDailyBudgetLimit();
    if (budget.exceeded) {
      const msg = `[Budget Exceeded] Límite diario de Gemini alcanzado: $${budget.cost.toFixed(2)} / $${budget.limit.toFixed(2)} USD.`;
      console.warn(msg);
      throw new Error(msg);
    }

    if (!supabase) throw new Error('Supabase cliente no disponible');

    // Cargar la fila de la incidencia
    const { data: incidence, error } = await supabase
      .from('bbm_incidences')
      .select('*')
      .eq('id', job.data.incidenceId)
      .single();

    if (error || !incidence) {
      throw new Error(`Incidencia ${job.data.incidenceId} no encontrada en base de datos: ${error?.message}`);
    }

    if (incidence.status !== 'pending' && incidence.status !== 'processing') {
      console.log(`[Planogram Worker] Incidencia ${job.data.incidenceId} ya está en estado '${incidence.status}', omitiendo.`);
      return { status: 'skipped', captureId: incidence.id };
    }

    // Marcar en proceso
    await supabase
      .from('bbm_incidences')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', incidence.id);

    // Inyectar dependencias reales
    const deps = {
      downloadPhoto,
      downloadPlanogram,
      buildIncidencePrompt,
      parseIncidenceResponse,
      analyzeWithReferences,
      supabase,
    };

    try {
      const result = await processIncidence(incidence, deps);
      console.log(`[Planogram Worker] Éxito en incidencia ${incidence.id}. Tokens: ${result.tokens}.`);
      return result;
    } catch (err: any) {
      console.error(`[Planogram Worker] Error procesando incidencia ${incidence.id}:`, err.message);
      
      const currentRetry = (incidence.retry_count || 0) + 1;
      const newStatus = currentRetry >= 3 ? 'failed' : 'pending';

      await supabase
        .from('bbm_incidences')
        .update({
          status: newStatus,
          retry_count: currentRetry,
          error_log: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', incidence.id);

      throw err;
    }
  },
  { connection, concurrency: 1 } // Concurrencia 1 para evitar exceso de llamadas paralelas a Gemini
);

// ─── Scheduler Periódico de Ingesta (Auto-Onboarding & Auto-Discovery) ───
async function runPeriodicIngest() {
  console.log('[Scheduler] Iniciando ciclo periódico de ingesta y auto-descubrimiento...');

  if (!supabase) {
    console.error('[Scheduler] Supabase no configurado. Cancelando ciclo.');
    return;
  }

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 2); // 2 días de ventana para ingesta segura e incremental

  const fromStr = yesterday.toISOString().split('T')[0];
  const toStr = today.toISOString().split('T')[0];

  try {
    // 1. DESCUBRIR Y PROCESAR UBIQO FORM IDS
    const ubiqoFormIds = new Set<number>();
    
    // De env
    if (process.env.UBIQO_DEFAULT_FORM_IDS) {
      process.env.UBIQO_DEFAULT_FORM_IDS.split(',').forEach(id => {
        const parsed = parseInt(id.trim(), 10);
        if (!isNaN(parsed)) ubiqoFormIds.add(parsed);
      });
    }

    // Auto-descubrimiento por base de datos
    const { data: dbUbiqoForms, error: ubiqoFormsErr } = await supabase
      .from('bbm_ubiqo_captures')
      .select('ubiqo_form_id');

    if (ubiqoFormsErr) {
      console.error('[Scheduler] Error auto-descubriendo formularios de Ubiqo:', ubiqoFormsErr.message);
    } else if (dbUbiqoForms) {
      dbUbiqoForms.forEach((row: any) => {
        const parsed = parseInt(row.ubiqo_form_id, 10);
        if (!isNaN(parsed)) ubiqoFormIds.add(parsed);
      });
    }

    console.log(`[Scheduler] Ubiqo Forms descubiertos para ingesta: [${Array.from(ubiqoFormIds).join(', ')}]`);

    for (const formId of Array.from(ubiqoFormIds)) {
      console.log(`[Scheduler] Ingeriendo Ubiqo Form ${formId}...`);
      try {
        const ingestResult = await ingestUbiqoCaptures(
          { form_id: formId, from: fromStr, to: toStr, tz: 'UTC' },
          { fetchCaptures, extractPhotos, encryptFirma, supabase }
        );
        console.log(`[Scheduler] Resultado Ubiqo Form ${formId}: Descubiertas: ${ingestResult.discovered}, Ya procesadas: ${ingestResult.alreadyProcessed}, Pendientes: ${ingestResult.pending}`);

        // Encolar trabajos pendientes
        if (ingestResult.pending > 0) {
          const { data: pendingCaptures } = await supabase
            .from('bbm_ubiqo_captures')
            .select('id')
            .eq('ubiqo_form_id', String(formId))
            .eq('status', 'pending');

          if (pendingCaptures) {
            for (const capture of pendingCaptures) {
              await ubiqoProcessQueue.add(`ubiqo-${capture.id}`, { captureId: capture.id });
              console.log(`[Scheduler] Encolado job ubiqo-process para captura ${capture.id}`);
            }
          }
        }
      } catch (err: any) {
        console.error(`[Scheduler] Fallo al ingerir Ubiqo Form ${formId}:`, err.message);
      }
    }

    // 2. DESCUBRIR Y PROCESAR PLANOGRAM FORM IDS
    const planogramFormIds = new Set<number>();

    // De env
    if (process.env.PLANOGRAM_DEFAULT_FORM_IDS) {
      process.env.PLANOGRAM_DEFAULT_FORM_IDS.split(',').forEach(id => {
        const parsed = parseInt(id.trim(), 10);
        if (!isNaN(parsed)) planogramFormIds.add(parsed);
      });
    }

    // Auto-descubrimiento por base de datos
    const { data: dbPlanogramForms, error: planogramFormsErr } = await supabase
      .from('bbm_planogram_assignments')
      .select('form_id');

    if (planogramFormsErr) {
      console.error('[Scheduler] Error auto-descubriendo formularios de Planogramas:', planogramFormsErr.message);
    } else if (dbPlanogramForms) {
      dbPlanogramForms.forEach((row: any) => {
        const parsed = parseInt(row.form_id, 10);
        if (!isNaN(parsed)) planogramFormIds.add(parsed);
      });
    }

    console.log(`[Scheduler] Planogram Forms descubiertos para ingesta: [${Array.from(planogramFormIds).join(', ')}]`);

    for (const formId of Array.from(planogramFormIds)) {
      console.log(`[Scheduler] Ingeriendo Planograma Form ${formId}...`);
      try {
        const ingestResult = await ingestPlanogramCaptures(
          { form_id: formId, from: fromStr, to: toStr, tz: 'UTC' },
          { fetchCaptures, extractPhotos, buildPhotoUrl, supabase }
        );
        console.log(`[Scheduler] Resultado Planograma Form ${formId}: Saltado: ${ingestResult.skipped || 'No'}, Descubiertas: ${ingestResult.discovered || 0}, Pendientes: ${ingestResult.pending || 0}`);

        // Encolar trabajos pendientes
        if (ingestResult.pending && ingestResult.pending > 0) {
          const { data: pendingIncidences } = await supabase
            .from('bbm_incidences')
            .select('id')
            .eq('status', 'pending'); // Nota: planogramas no tienen ubiqo_form_id directo en incidences sino planogram_id

          if (pendingIncidences) {
            for (const incidence of pendingIncidences) {
              await planogramProcessQueue.add(`planogram-${incidence.id}`, { incidenceId: incidence.id });
              console.log(`[Scheduler] Encolado job planogram-process para incidencia ${incidence.id}`);
            }
          }
        }
      } catch (err: any) {
        console.error(`[Scheduler] Fallo al ingerir Planograma Form ${formId}:`, err.message);
      }
    }

  } catch (globalErr: any) {
    console.error('[Scheduler] Error crítico global en ciclo periódico de ingesta:', globalErr.message);
  }
}

// ─── Inicialización y Bucle Principal ───
console.log('🚀 Iniciando Worker de Black Box Magic...');

// Manejo graceful de apagado
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await ubiqoWorker.close();
  await planogramWorker.close();
  await connection.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Levantar el panel de administración Bull Board
import './board';

// Ejecutar ingesta de inmediato y programar cada 5 minutos
runPeriodicIngest();
const INGEST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
setInterval(runPeriodicIngest, INGEST_INTERVAL_MS);
