import { Queue } from 'bullmq';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Dependencias necesarias para ejecutar la reconciliación.
 * Permite inyectar mocks durante las pruebas unitarias para no depender de Redis/Supabase reales.
 */
export interface ReconcileDeps {
  supabase: SupabaseClient;
  ubiqoQueue: Queue;
  planogramQueue: Queue;
}

/**
 * Reconcilia los trabajos que se quedaron atascados en estado 'processing'.
 * Si una fila de captura o incidencia lleva más de 15 minutos en 'processing',
 * verifica si hay un trabajo activo, en espera o retrasado en su respectiva cola de BullMQ.
 * Si no hay un trabajo vivo, regresa el estado a 'pending' (o 'failed' si ya alcanzó o superó el límite de 2 reintentos).
 *
 * @param deps Dependencias inyectadas (Supabase y colas de BullMQ)
 * @returns Promesa con los conteos de filas devueltas a 'pending'
 */
export async function reconcileProcessingJobs(deps: ReconcileDeps): Promise<{
  ubiqoRequeued: number;
  planogramRequeued: number;
}> {
  console.log('[Reconcile] Iniciando ciclo de reconciliación de estados...');

  if (!deps.supabase) {
    console.error('[Reconcile] Cliente de Supabase no disponible. Cancelando ciclo.');
    return { ubiqoRequeued: 0, planogramRequeued: 0 };
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let ubiqoRequeued = 0;
  let planogramRequeued = 0;

  // 1. Reconciliar bbm_ubiqo_captures
  try {
    const { data: stuckCaptures, error: ubiqoErr } = await deps.supabase
      .from('bbm_ubiqo_captures')
      .select('id, retry_count, bullmq_job_id')
      .eq('status', 'processing')
      .lt('updated_at', fifteenMinutesAgo);

    if (ubiqoErr) {
      console.error('[Reconcile] Error consultando capturas stuck de Ubiqo:', ubiqoErr.message);
    } else if (stuckCaptures && stuckCaptures.length > 0) {
      console.log(`[Reconcile] Se encontraron ${stuckCaptures.length} capturas de Ubiqo potencialmente atascadas.`);
      
      for (const capture of stuckCaptures) {
        let isJobActive = false;

        if (capture.bullmq_job_id) {
          try {
            const job = await deps.ubiqoQueue.getJob(capture.bullmq_job_id);
            if (job) {
              const state = await job.getState();
              // Un trabajo está vivo si está 'active', 'waiting' o 'delayed'
              if (state === 'active' || state === 'waiting' || state === 'delayed') {
                isJobActive = true;
              }
            }
          } catch (jobErr: any) {
            console.warn(`[Reconcile] No se pudo obtener el estado del job ${capture.bullmq_job_id} para la captura ${capture.id}:`, jobErr.message);
          }
        }

        if (!isJobActive) {
          const retryCount = capture.retry_count || 0;
          // Si ya tiene 2 o más intentos, marcamos como fallido permanentemente
          const newStatus = retryCount >= 2 ? 'failed' : 'pending';

          const updatePayload: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };

          if (newStatus === 'failed') {
            updatePayload.error_log = 'Reconciliado: El trabajo se quedó atascado en procesamiento y superó el límite de reintentos.';
            updatePayload.error_kind = 'permanent';
          } else {
            ubiqoRequeued++;
          }

          const { error: updateErr } = await deps.supabase
            .from('bbm_ubiqo_captures')
            .update(updatePayload)
            .eq('id', capture.id);

          if (updateErr) {
            console.error(`[Reconcile] Error actualizando captura ${capture.id}:`, updateErr.message);
          } else {
            console.log(`[Reconcile] Captura ${capture.id} reconciliada exitosamente a estado '${newStatus}'.`);
          }
        } else {
          console.log(`[Reconcile] Captura ${capture.id} sigue activa en BullMQ con job ${capture.bullmq_job_id}. Se omite.`);
        }
      }
    }
  } catch (err: any) {
    console.error('[Reconcile] Error inesperado reconciliando capturas de Ubiqo:', err.message);
  }

  // 2. Reconciliar bbm_incidences
  try {
    const { data: stuckIncidences, error: incidenceErr } = await deps.supabase
      .from('bbm_incidences')
      .select('id, retry_count, bullmq_job_id')
      .eq('status', 'processing')
      .lt('updated_at', fifteenMinutesAgo);

    if (incidenceErr) {
      console.error('[Reconcile] Error consultando incidencias stuck:', incidenceErr.message);
    } else if (stuckIncidences && stuckIncidences.length > 0) {
      console.log(`[Reconcile] Se encontraron ${stuckIncidences.length} incidencias de planogramas potencialmente atascadas.`);

      for (const incidence of stuckIncidences) {
        let isJobActive = false;

        if (incidence.bullmq_job_id) {
          try {
            const job = await deps.planogramQueue.getJob(incidence.bullmq_job_id);
            if (job) {
              const state = await job.getState();
              // Un trabajo está vivo si está 'active', 'waiting' o 'delayed'
              if (state === 'active' || state === 'waiting' || state === 'delayed') {
                isJobActive = true;
              }
            }
          } catch (jobErr: any) {
            console.warn(`[Reconcile] No se pudo obtener el estado del job ${incidence.bullmq_job_id} para la incidencia ${incidence.id}:`, jobErr.message);
          }
        }

        if (!isJobActive) {
          const retryCount = incidence.retry_count || 0;
          // Si ya tiene 2 o más intentos, marcamos como fallido permanentemente
          const newStatus = retryCount >= 2 ? 'failed' : 'pending';

          const updatePayload: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };

          if (newStatus === 'failed') {
            updatePayload.error_log = 'Reconciliado: El trabajo se quedó atascado en procesamiento y superó el límite de reintentos.';
            updatePayload.error_kind = 'permanent';
          } else {
            planogramRequeued++;
          }

          const { error: updateErr } = await deps.supabase
            .from('bbm_incidences')
            .update(updatePayload)
            .eq('id', incidence.id);

          if (updateErr) {
            console.error(`[Reconcile] Error actualizando incidencia ${incidence.id}:`, updateErr.message);
          } else {
            console.log(`[Reconcile] Incidencia ${incidence.id} reconciliada exitosamente a estado '${newStatus}'.`);
          }
        } else {
          console.log(`[Reconcile] Incidencia ${incidence.id} sigue activa en BullMQ con job ${incidence.bullmq_job_id}. Se omite.`);
        }
      }
    }
  } catch (err: any) {
    console.error('[Reconcile] Error inesperado reconciliando incidencias:', err.message);
  }

  const totalRequeued = ubiqoRequeued + planogramRequeued;
  console.log(`[Reconcile] Ciclo completado. RECONCILE_REQUEUED=${totalRequeued}`);

  return { ubiqoRequeued, planogramRequeued };
}
