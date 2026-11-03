/** Remove private API responses left by older service workers. */
export async function clearPrivateApiCache(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete('supabase-cache')
}
