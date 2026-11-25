import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 포트는 Keycloak 클라이언트의 redirect URI 와 맞물려 있으므로 고정한다 (strictPort).
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
});
