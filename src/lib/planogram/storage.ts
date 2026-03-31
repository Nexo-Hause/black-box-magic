/**
 * Planogram Storage — Supabase Storage operations
 *
 * Upload, download, and generate signed URLs for planogram images.
 * Uses private bucket with time-limited signed URLs (30 min TTL).
 */

import { supabase } from '@/lib/supabase';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'planograms';
const SIGNED_URL_TTL = 30 * 60; // 30 minutes in seconds

export async function uploadPlanogram(
  path: string,
  file: Buffer | Uint8Array,
  mimeType: string
): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) return { error: error.message };
  return { path };
}

export async function downloadPlanogram(
  path: string
): Promise<{ data: Blob } | { error: string }> {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (error || !data) return { error: error?.message || 'Download failed' };
  return { data };
}

export async function getSignedUrl(
  path: string,
  ttl: number = SIGNED_URL_TTL
): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttl);

  if (error || !data?.signedUrl) {
    console.warn('Failed to generate signed URL:', error?.message);
    return null;
  }

  return data.signedUrl;
}

export async function getSignedUrls(
  paths: string[],
  ttl: number = SIGNED_URL_TTL
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  // Generate in parallel
  const promises = paths.map(async (path) => {
    const url = await getSignedUrl(path, ttl);
    if (url) result[path] = url;
  });
  await Promise.all(promises);
  return result;
}

export async function deletePlanogram(
  path: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not configured' };

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
