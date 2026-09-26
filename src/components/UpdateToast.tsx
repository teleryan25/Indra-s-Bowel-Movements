import { useEffect, useState } from 'react';

/** Shows a gentle prompt when a new version of the app has been downloaded in the background. */
export function UpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const on = (e: Event) => setWaiting((e as CustomEvent<ServiceWorker>).detail);
    window.addEventListener('ibo:update-ready', on);
    return () => window.removeEventListener('ibo:update-ready', on);
  }, []);
  if (!waiting) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>A fresh version is ready.</span>
      <button onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>Refresh</button>
    </div>
  );
}
