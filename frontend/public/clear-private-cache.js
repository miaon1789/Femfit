// Delete private responses cached by older FemFit service workers on upgrade.
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('supabase-cache'))
})
