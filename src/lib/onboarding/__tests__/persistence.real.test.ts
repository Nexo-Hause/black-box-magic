import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '@/lib/supabase';
import { createEmptyPartialConfig } from '@/lib/onboarding/tools';
import { randomUUID } from 'crypto';

describe('Direct Real Database Integration Test (BBM Client Configs)', () => {
  const testEmail = `qa-test-${randomUUID().slice(0, 6)}@blackboxmagic.com`;
  const testClientId = `cli-qa-test-${randomUUID().slice(0, 6)}`;
  const testClientName = 'QA Test Company Inc.';
  const testSessionId = randomUUID();

  beforeAll(() => {
    if (!supabase) {
      throw new Error('Supabase client is not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    }
  });

  it('debe insertar, actualizar, listar y limpiar una sesion real en Supabase sin mocks', async () => {
    // 1. Insert: crear una fila borrador en bbm_client_configs
    console.log(`[QA Real Test] Creando borrador en Supabase para el email: ${testEmail}...`);
    const { error: insertError } = await supabase!
      .from('bbm_client_configs')
      .insert({
        id: testSessionId,
        client_id: testClientId,
        client_name: testClientName,
        industry: 'qsr',
        status: 'draft',
        transcript: [{ role: 'assistant', content: 'Prueba de QA en caliente' }],
        partial_config: createEmptyPartialConfig(),
        created_by: testEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    expect(insertError).toBeNull();
    console.log('[QA Real Test] Borrador creado con éxito.');

    // 2. Fetch: Recuperar la fila por ID y verificar que los datos coincidan
    const { data: fetchedRow, error: fetchError } = await supabase!
      .from('bbm_client_configs')
      .select('*')
      .eq('id', testSessionId)
      .maybeSingle();

    expect(fetchError).toBeNull();
    expect(fetchedRow).not.toBeNull();
    expect(fetchedRow.client_id).toBe(testClientId);
    expect(fetchedRow.client_name).toBe(testClientName);
    expect(fetchedRow.created_by).toBe(testEmail);
    expect(fetchedRow.status).toBe('draft');
    console.log('[QA Real Test] Verificación de lectura inicial correcta.');

    // 3. Update (Persistencia del Sandbox): Guardar fotos base64 ficticias
    const mockPhotos = [
      { id: 'photo-qa-1', fileName: 'caja_limpia.png', status: 'done', rating: 'ok', feedback: 'Excelente orden' }
    ];
    console.log('[QA Real Test] Actualizando sandbox_photos en caliente...');
    
    const updatedPartialConfig = {
      ...createEmptyPartialConfig(),
      sandbox_photos: mockPhotos,
      iteration_count: 1
    };

    const { error: updateError } = await supabase!
      .from('bbm_client_configs')
      .update({
        partial_config: updatedPartialConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testSessionId);

    expect(updateError).toBeNull();
    console.log('[QA Real Test] Sandbox photos persistidas exitosamente.');

    // 4. Query List (Resume): Listar sesiones filtradas por el correo del creador
    console.log(`[QA Real Test] Buscando sesiones asociadas al email: ${testEmail}...`);
    const { data: listSessions, error: listError } = await supabase!
      .from('bbm_client_configs')
      .select('id, client_id, client_name, status, partial_config')
      .eq('created_by', testEmail);

    expect(listError).toBeNull();
    expect(listSessions).toHaveLength(1);
    expect(listSessions![0].id).toBe(testSessionId);
    expect(listSessions![0].client_name).toBe(testClientName);
    expect((listSessions![0].partial_config as any).sandbox_photos).toEqual(mockPhotos);
    console.log('[QA Real Test] Búsqueda por correo y validación de reanudación exitosa.');

    // 5. History: Listar historial para el client_id actual
    console.log(`[QA Real Test] Listando historial para el client_id: ${testClientId}...`);
    const { data: historyList, error: historyError } = await supabase!
      .from('bbm_client_configs')
      .select('id, version, status')
      .eq('client_id', testClientId)
      .order('version', { ascending: false });

    expect(historyError).toBeNull();
    expect(historyList).toHaveLength(1);
    expect(historyList![0].id).toBe(testSessionId);
    console.log('[QA Real Test] Consulta de historial de versiones correcta.');

    // 6. Cleanup: Borrar la fila de prueba para mantener la base de datos impecable
    console.log(`[QA Real Test] Limpiando fila de prueba con id: ${testSessionId}...`);
    const { error: deleteError } = await supabase!
      .from('bbm_client_configs')
      .delete()
      .eq('id', testSessionId);

    expect(deleteError).toBeNull();
    console.log('[QA Real Test] Fila de prueba eliminada exitosamente. ¡QA exitoso!');
  });
});
