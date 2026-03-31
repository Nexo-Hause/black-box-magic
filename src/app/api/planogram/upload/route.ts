import { NextRequest, NextResponse } from 'next/server';
import { verifyCookie, COOKIE_NAME } from '@/lib/cookie';
import { supabase } from '@/lib/supabase';

export const maxDuration = 30;

// ─── Helpers ───

function isAllowedEmail(email: string): boolean {
  const allowlist = process.env.DASHBOARD_ALLOWED_EMAILS || '';
  if (!allowlist) return true; // If not configured, allow all authenticated users
  return allowlist.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase());
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mime] || 'bin';
}

// ─── Route handler ───

export async function POST(request: NextRequest) {
  // 1. Auth — require email cookie
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const cookiePayload = cookieValue ? verifyCookie(cookieValue) : null;
  if (!cookiePayload) {
    return NextResponse.json(
      { error: 'Se requiere email. Ingresa tu email primero.', status: 401 },
      { status: 401 },
    );
  }

  // 2. Allowlist check
  if (!isAllowedEmail(cookiePayload.email)) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar planogramas.', status: 403 },
      { status: 403 },
    );
  }

  // 3. Supabase required for this endpoint
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase no configurado. No se pueden gestionar planogramas.', status: 503 },
      { status: 503 },
    );
  }

  // 4. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Se esperaba multipart/form-data.', status: 400 },
      { status: 400 },
    );
  }

  const file = formData.get('file') as File | null;
  const clientKey = formData.get('clientKey') as string | null;
  const name = formData.get('name') as string | null;
  const section = formData.get('section') as string | null;

  // 5. Validate required fields
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'Se requiere el campo "file" con una imagen.', status: 400 },
      { status: 400 },
    );
  }

  if (!clientKey || !clientKey.trim()) {
    return NextResponse.json(
      { error: 'Se requiere el campo "clientKey".', status: 400 },
      { status: 400 },
    );
  }

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: 'Se requiere el campo "name".', status: 400 },
      { status: 400 },
    );
  }

  // 6. Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${file.type}. Solo JPEG, PNG y WebP.`, status: 400 },
      { status: 400 },
    );
  }

  // 7. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `El archivo excede el límite de 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`, status: 413 },
      { status: 413 },
    );
  }

  try {
    // 8. Generate storage path
    const ext = extFromMime(file.type);
    const timestamp = Date.now();
    const storagePath = `${clientKey.trim()}/${timestamp}.${ext}`;
    const bucket = process.env.PLANOGRAM_STORAGE_BUCKET || 'planograms';

    // 9. Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error('Error al subir planograma a Storage:', uploadErr.message);
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    // 10. Deactivate previous active planogram for this clientKey
    const { error: deactivateErr } = await supabase
      .from('bbm_planograms')
      .update({ active: false })
      .eq('client_key', clientKey.trim())
      .eq('active', true);

    if (deactivateErr) {
      console.error('Error al desactivar planogramas anteriores:', deactivateErr.message);
      // Continue — new planogram should still be inserted
    }

    // 11. Insert new planogram record
    const planogramId = crypto.randomUUID();
    const { data: planogram, error: insertErr } = await supabase
      .from('bbm_planograms')
      .insert({
        id: planogramId,
        client_key: clientKey.trim(),
        name: name.trim(),
        section: section?.trim() || null,
        storage_path: storagePath,
        storage_bucket: bucket,
        file_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: cookiePayload.email,
        active: true,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error al insertar planograma:', insertErr.message);
      return NextResponse.json(
        { error: `Error al registrar planograma: ${insertErr.message}`, status: 500 },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      planogram,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Upload de planograma falló:', message);
    return NextResponse.json(
      { error: `Error al subir planograma: ${message}`, status: 500 },
      { status: 500 },
    );
  }
}
