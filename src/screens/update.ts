/** "Actualizează acum" (2026-11-16): drops the installed service worker and the app's caches (not the data: that is in
 *  localStorage and IndexedDB), then loads the app fresh from the network. */
export async function forceUpdate(keep: string[] = []) {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
  } catch { /* whatever could be cleared is cleared */ }
  location.reload();
}
