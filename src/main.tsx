// Prevent external libraries from overwriting window.fetch improperly
if (typeof window !== 'undefined') {
  try {
    const originalFetch = window.fetch;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (descriptor && descriptor.configurable === false) {
      // already locked, nothing to do
    } else if (originalFetch) {
      Object.defineProperty(window, 'fetch', {
        get: () => originalFetch,
        set: (v) => {
           if (v !== originalFetch) {
             console.warn('Blocked attempt to overwrite window.fetch.');
           }
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch (e) {}
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
