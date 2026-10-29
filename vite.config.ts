import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Satu entri HTML per deck. Tambahkan deck baru di sini dan di src/decks/registry.ts.
const pages = ['index', 'dijkstra', 'distance-vector', 'lsa-flooding', 'subnetting', 'rdt', 'tcp-cc', 'error-detection', 'csma-cd', 'switch-arp', 'lpm', 'tcp-handshake', 'dhcp'];

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])),
      output: {
        // Pecah pustaka besar menjadi chunk sendiri: di-cache terpisah dan tiap chunk < 500 kB.
        codeSplitting: {
          groups: [
            { name: 'katex', test: /node_modules[\\/]katex/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'reveal', test: /node_modules[\\/](reveal\.js|@revealjs)/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
