/** Connectivity in the browser via navigator.onLine and the online/offline events. */
export function subscribeToConnectivity(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const update = () => onChange(navigator.onLine);
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
