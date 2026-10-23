import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // The 3D scene chunk is mostly three.js (~870 kB) and is loaded lazily after the
  // panels, so it is allowed to be larger than Vite's default 500 kB warning.
  build: { chunkSizeWarningLimit: 900 },
});
