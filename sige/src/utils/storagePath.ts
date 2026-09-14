/** Normaliza valores históricos de Supabase Storage a una ruta interna segura. */
export function normalizeStoragePath(value: string | null | undefined, bucket: string): string | null {
  if (!value?.trim() || !bucket.trim()) return null;
  let candidate = value.trim();
  try {
    const url = new URL(candidate);
    candidate = decodeURIComponent(url.pathname);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];
    const marker = markers.find(item => candidate.includes(item));
    if (!marker) return null;
    candidate = candidate.slice(candidate.indexOf(marker) + marker.length);
  } catch {
    candidate = decodeURIComponent(candidate.split('?')[0].split('#')[0]).replace(/^\/+/, '');
  }
  while (candidate.startsWith(`${bucket}/`)) candidate = candidate.slice(bucket.length + 1);
  candidate = candidate.replace(/\/{2,}/g, '/');
  if (!candidate || candidate.startsWith('/') || candidate.split('/').some(p => !p || p === '.' || p === '..')) return null;
  return candidate;
}
