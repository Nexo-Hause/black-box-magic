-- Migración 010: Añadir columnas error_kind y bullmq_job_id para endurecimiento y reconciliación (WS-H)

-- Agregar columnas en bbm_ubiqo_captures
ALTER TABLE bbm_ubiqo_captures ADD COLUMN IF NOT EXISTS error_kind TEXT;
ALTER TABLE bbm_ubiqo_captures ADD COLUMN IF NOT EXISTS bullmq_job_id TEXT;

-- Agregar columnas en bbm_incidences
ALTER TABLE bbm_incidences ADD COLUMN IF NOT EXISTS error_kind TEXT;
ALTER TABLE bbm_incidences ADD COLUMN IF NOT EXISTS bullmq_job_id TEXT;

-- Agregar comentarios para documentación en DB
COMMENT ON COLUMN bbm_ubiqo_captures.error_kind IS 'Clasificación del error del pipeline (transient | permanent | safety_block | ubiqo_auth)';
COMMENT ON COLUMN bbm_ubiqo_captures.bullmq_job_id IS 'ID único del trabajo asociado en la cola de BullMQ para reconciliación de estado';

COMMENT ON COLUMN bbm_incidences.error_kind IS 'Clasificación del error del pipeline (transient | permanent | safety_block | ubiqo_auth)';
COMMENT ON COLUMN bbm_incidences.bullmq_job_id IS 'ID único del trabajo asociado en la cola de BullMQ para reconciliación de estado';
